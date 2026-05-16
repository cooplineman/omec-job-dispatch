"use client";

// Member portal query is filtered by logged-in email.


import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient, type User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type MemberJob = {
  job_number: string;
  applicant_name: string;
  member_number: string | null;
  email: string | null;
  service_address_line1: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  public_status: string;
  site_visit_at: string | null;
  estimate_amount: number | null;
  deposit_required: number | null;
  deposit_received: number | null;
  energized_at: string | null;
  created_at: string;
  updated_at: string;
};

type TimelineStep = {
  label: string;
  status: "complete" | "current" | "pending" | "not_required";
  detail?: string;
};

export default function MemberPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [selectedJobNumber, setSelectedJobNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedJob = useMemo(
    () => jobs.find((job) => job.job_number === selectedJobNumber) || jobs[0],
    [jobs, selectedJobNumber]
  );

  const timeline = useMemo(
    () => buildMemberTimeline(selectedJob || null),
    [selectedJob]
  );

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;

      setUser(sessionUser);
      setAuthLoading(false);

      if (sessionUser) {
        await loadMemberJobs();
      }
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadMemberJobs();
        } else {
          setJobs([]);
          setSelectedJobNumber("");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setMessage(`Login failed: ${error.message}`);
    } else {
      setLoginPassword("");
      setMessage("Logged in successfully.");
    }

    setLoginBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("Logged out.");
  }

  async function loadMemberJobs() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("member_job_portal_view")
      .select("*")
      .eq("email", user?.email || "")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading member portal: ${error.message}`);
      setJobs([]);
    } else {
      const loadedJobs = data || [];
      setJobs(loadedJobs);

      if (loadedJobs.length > 0) {
        setSelectedJobNumber(loadedJobs[0].job_number);
      }
    }

    setLoading(false);
  }

  if (authLoading) {
    return (
      <main style={mainStyle}>
        <h1>OMEC Connect</h1>
        <p>Checking login...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={mainStyle}>
        <Header />

        <section style={sectionStyle}>
          <h2>Member Portal Login</h2>
          <p>Log in to view the status of your OMEC service request.</p>

          {message && <p style={messageStyle}>{message}</p>}

          <form onSubmit={signIn} style={panelStyle}>
            <label style={labelStyle}>
              Email
              <input
                value={loginEmail}
                required
                onChange={(event) => setLoginEmail(event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                type="password"
                value={loginPassword}
                required
                onChange={(event) => setLoginPassword(event.target.value)}
                style={inputStyle}
              />
            </label>

            <button type="submit" disabled={loginBusy} style={buttonStyle}>
              {loginBusy ? "Logging in..." : "Log In"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <div style={topBarStyle}>
        <Header />
        <button type="button" onClick={signOut} style={secondaryButtonStyle}>
          Log Out
        </button>
      </div>

      {message && <p style={messageStyle}>{message}</p>}

      <section style={sectionStyle}>
        <h2>My Service Request</h2>
        <p>
          Logged in as <strong>{user.email}</strong>
        </p>

        {loading && <p>Loading your service request...</p>}

        {!loading && jobs.length === 0 && (
          <p style={emptyStateStyle}>
            No service requests were found for this login. If you believe this
            is incorrect, please contact OMEC.
          </p>
        )}

        {jobs.length > 1 && (
          <label style={labelStyle}>
            Select Job
            <select
              value={selectedJob?.job_number || ""}
              onChange={(event) => setSelectedJobNumber(event.target.value)}
              style={inputStyle}
            >
              {jobs.map((job) => (
                <option key={job.job_number} value={job.job_number}>
                  {job.job_number} — {job.service_address_line1}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selectedJob && (
        <>
          <section style={sectionStyle}>
            <h2>Status</h2>

            <div style={statusCardStyle}>
              <div style={statusLabelStyle}>Current Status</div>
              <div style={statusTextStyle}>{selectedJob.public_status}</div>
              <div style={mutedStyle}>
                Last updated {formatDateTime(selectedJob.updated_at)}
              </div>
            </div>

            <div style={detailGridStyle}>
              <Detail label="Job Number" value={selectedJob.job_number} />
              <Detail label="Name" value={selectedJob.applicant_name} />
              <Detail label="Member #" value={selectedJob.member_number} />
              <Detail
                label="Service Address"
                value={`${selectedJob.service_address_line1}, ${
                  selectedJob.city || ""
                }, ${selectedJob.state || ""} ${
                  selectedJob.postal_code || ""
                }`}
              />
              <Detail
                label="Site Visit"
                value={formatDateTime(selectedJob.site_visit_at)}
              />
              <Detail
                label="Estimate Amount"
                value={formatEstimate(selectedJob)}
              />
              <Detail
                label="Deposit"
                value={formatDeposit(selectedJob)}
              />
              <Detail
                label="Energized"
                value={formatDateTime(selectedJob.energized_at)}
              />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2>Progress Timeline</h2>

            <div style={timelineStyle}>
              {timeline.map((step) => (
                <div key={step.label} style={timelineRowStyle}>
                  <div style={timelineIconStyle}>
                    {getStepIcon(step.status)}
                  </div>

                  <div>
                    <div style={timelineLabelStyle}>{step.label}</div>
                    {step.detail && (
                      <div style={mutedStyle}>{step.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={sectionStyle}>
            <h2>Need Help?</h2>
            <p>
              If you have questions about your service request, please contact
              OMEC and reference job number{" "}
              <strong>{selectedJob.job_number}</strong>.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

function Header() {
  return (
    <div style={brandHeaderStyle}>
      <Image
        src="/omec-logo.png"
        alt="OMEC logo"
        width={84}
        height={84}
        style={logoStyle}
      />

      <div>
        <h1 style={{ marginBottom: "4px" }}>OMEC Connect</h1>
        <p style={{ marginTop: 0 }}>Member Service Portal</p>
      </div>
    </div>
  );
}

function buildMemberTimeline(job: MemberJob | null): TimelineStep[] {
  if (!job) return [];

  const estimateNotRequired = Number(job.estimate_amount ?? -1) === 0;
  const depositNotRequired = Number(job.deposit_required ?? -1) === 0;
  const estimateSentOrBeyond = [
    "Awaiting Deposit",
    "Ready For Construction",
    "Construction Delayed",
    "Waiting On Member Information",
    "Construction In Progress",
    "Inspection Pending",
    "Final Billing",
    "Service Energized",
  ].includes(job.public_status);

  const constructionStarted = [
    "Construction In Progress",
    "Inspection Pending",
    "Final Billing",
    "Service Energized",
  ].includes(job.public_status);

  const inspectionReached = [
    "Inspection Pending",
    "Final Billing",
    "Service Energized",
  ].includes(job.public_status);

  const serviceEnergized = job.public_status === "Service Energized";

  return [
    {
      label: "Application Received",
      status: "complete",
    },
    {
      label: "Membership Complete",
      status:
        job.public_status === "Application Received" ? "current" : "complete",
    },
    {
      label: "Site Visit",
      status: job.site_visit_at ? "complete" : "pending",
      detail: job.site_visit_at
        ? formatDateTime(job.site_visit_at)
        : "To be scheduled",
    },
    {
      label: estimateNotRequired ? "Estimate Not Required" : "Estimate Sent",
      status: estimateNotRequired
        ? "not_required"
        : estimateSentOrBeyond
        ? "complete"
        : job.public_status === "Estimate In Progress"
        ? "current"
        : "pending",
    },
    {
      label: estimateNotRequired
        ? "Estimate Approval Not Required"
        : "Estimate Approved",
      status: estimateNotRequired
        ? "not_required"
        : estimateSentOrBeyond
        ? "complete"
        : "pending",
    },
    {
      label: depositNotRequired ? "Deposit Not Required" : "Deposit Received",
      status: depositNotRequired
        ? "not_required"
        : Number(job.deposit_received ?? 0) >= Number(job.deposit_required ?? 0)
        ? "complete"
        : job.public_status === "Awaiting Deposit"
        ? "current"
        : "pending",
    },
    {
      label: "Construction",
      status: constructionStarted
        ? "complete"
        : [
            "Ready For Construction",
            "Construction Delayed",
            "Waiting On Member Information",
          ].includes(job.public_status)
        ? "current"
        : "pending",
      detail: job.public_status.includes("Construction")
        ? job.public_status
        : undefined,
    },
    {
      label: "Inspection",
      status: inspectionReached
        ? serviceEnergized
          ? "complete"
          : "current"
        : "pending",
    },
    {
      label: "Service Energized",
      status: serviceEnergized ? "complete" : "pending",
      detail: job.energized_at ? formatDateTime(job.energized_at) : undefined,
    },
  ];
}

function getStepIcon(status: TimelineStep["status"]) {
  if (status === "complete") return "✅";
  if (status === "current") return "🔄";
  if (status === "not_required") return "➖";
  return "⬜";
}

function formatEstimate(job: MemberJob) {
  if (job.estimate_amount === null) return "Pending";
  if (Number(job.estimate_amount) === 0) return "Not Required";
  return `$${Number(job.estimate_amount).toFixed(2)}`;
}

function formatDeposit(job: MemberJob) {
  if (Number(job.deposit_required ?? 0) === 0) return "Not Required";

  return `$${Number(job.deposit_received ?? 0).toFixed(2)} received of $${Number(
    job.deposit_required ?? 0
  ).toFixed(2)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  return date.toLocaleString();
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: "#555", fontWeight: 700 }}>
        {label}
      </div>
      <div>{value || "-"}</div>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  padding: "40px",
  fontFamily: "Arial, sans-serif",
  background: "transparent",
  color: "#111111",
  minHeight: "100vh",
};

const brandHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
};

const logoStyle: React.CSSProperties = {
  width: "84px",
  height: "84px",
  objectFit: "contain",
  borderRadius: "999px",
  background: "#fffaf0",
  padding: "6px",
  border: "2px solid #d8c8a3",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const sectionStyle: React.CSSProperties = {
  marginTop: "32px",
  maxWidth: "900px",
  background: "#fffaf0",
  color: "#111111",
  border: "1px solid #d8c8a3",
  borderRadius: "14px",
  padding: "18px",
};

const panelStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  border: "1px solid #d8c8a3",
  background: "#fffdf7",
  borderRadius: "14px",
};

const messageStyle: React.CSSProperties = {
  padding: "12px",
  border: "1px solid #d8c8a3",
  background: "#fffaf0",
  color: "#111111",
  borderRadius: "12px",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "16px",
  border: "1px dashed #999",
  background: "#fffdf7",
  borderRadius: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginTop: "12px",
  color: "#111111",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px",
  marginTop: "4px",
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #d8c8a3",
  borderRadius: "10px",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "10px 16px",
  cursor: "pointer",
  background: "#1f4d3a",
  color: "#ffffff",
  border: "1px solid #143528",
  borderRadius: "999px",
};

const secondaryButtonStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "10px 16px",
  cursor: "pointer",
  background: "#fffaf0",
  color: "#143528",
  border: "1px solid #c89b3c",
  borderRadius: "999px",
};

const statusCardStyle: React.CSSProperties = {
  padding: "18px",
  border: "1px solid #d8c8a3",
  background: "#fffdf7",
  borderRadius: "14px",
  marginBottom: "18px",
};

const statusLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#555555",
};

const statusTextStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 800,
  color: "#143528",
};

const mutedStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#555555",
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const timelineStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const timelineRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  padding: "12px",
  border: "1px solid #d8c8a3",
  borderRadius: "12px",
  background: "#fffdf7",
};

const timelineIconStyle: React.CSSProperties = {
  fontSize: "22px",
  lineHeight: "1",
};

const timelineLabelStyle: React.CSSProperties = {
  fontWeight: 700,
};