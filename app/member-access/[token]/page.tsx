"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

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

export default function MemberAccessPage({
  params,
}: {
  params: { token: string };
}) {
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [selectedJobNumber, setSelectedJobNumber] = useState("");
  const [loading, setLoading] = useState(true);
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
    async function loadAccess() {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase.rpc(
        "get_member_jobs_by_access_token",
        { p_token: params.token }
      );

      if (error) {
        setMessage(`Unable to load access link: ${error.message}`);
        setJobs([]);
      } else {
        const loadedJobs = (data || []) as MemberJob[];
        setJobs(loadedJobs);

        if (loadedJobs.length > 0) {
          setSelectedJobNumber(loadedJobs[0].job_number);
        }
      }

      setLoading(false);
    }

    loadAccess();
  }, [params.token]);

  if (loading) {
    return (
      <main style={mainStyle}>
        <Header />
        <section style={sectionStyle}>
          <p>Loading your service request...</p>
        </section>
      </main>
    );
  }

  if (message || jobs.length === 0) {
    return (
      <main style={mainStyle}>
        <Header />
        <section style={sectionStyle}>
          <h2>Access Link Unavailable</h2>
          <p style={emptyStateStyle}>
            This service request link is expired, invalid, or no longer active.
            Please contact OMEC if you need a new link.
          </p>
          {message && <p style={messageStyle}>{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <Header />

      <section style={sectionStyle}>
        <h2>My Service Request</h2>

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

        {selectedJob && (
          <>
            <div style={statusCardStyle}>
              <div style={statusLabelStyle}>Current Status</div>
              <div style={statusTextStyle}>
                {formatPublicStatus(selectedJob.public_status)}
              </div>
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
                label="Estimate"
                value={formatEstimate(selectedJob)}
              />
              <Detail
                label="Deposit"
                value={formatDeposit(selectedJob)}
              />
              <Detail
                label="Service Energized"
                value={formatDateTime(selectedJob.energized_at)}
              />
            </div>
          </>
        )}
      </section>

      {selectedJob && (
        <>
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

  const publicStatus = formatPublicStatus(job.public_status);
  const estimateNotRequired = Number(job.estimate_amount ?? -1) === 0;
  const depositNotRequired = Number(job.deposit_required ?? -1) === 0;

  const membershipComplete = ![
    "Application Received",
    "Membership Needed",
  ].includes(publicStatus);

  const siteVisitComplete = Boolean(job.site_visit_at);

  const estimateSentOrBeyond = [
    "Awaiting Deposit",
    "Ready For Construction",
    "Construction Delayed",
    "Waiting On Member Information",
    "Construction In Progress",
    "Inspection Pending",
    "Final Billing",
    "Service Energized",
  ].includes(publicStatus);

  const constructionActive = [
    "Ready For Construction",
    "Construction Delayed",
    "Waiting On Member Information",
    "Construction In Progress",
  ].includes(publicStatus);

  const constructionComplete = [
    "Inspection Pending",
    "Final Billing",
    "Service Energized",
  ].includes(publicStatus);

  const inspectionReached = [
    "Inspection Pending",
    "Final Billing",
    "Service Energized",
  ].includes(publicStatus);

  const serviceEnergized = publicStatus === "Service Energized";

  return [
    { label: "Application Received", status: "complete" },
    {
      label: "Membership Complete",
      status: membershipComplete ? "complete" : "current",
    },
    {
      label: "Site Visit",
      status: siteVisitComplete
        ? "complete"
        : publicStatus === "Site Visit Scheduling"
        ? "current"
        : "pending",
      detail: siteVisitComplete
        ? formatDateTime(job.site_visit_at)
        : "To be scheduled",
    },
    {
      label: estimateNotRequired ? "Estimate Not Required" : "Estimate Sent",
      status: estimateNotRequired
        ? "not_required"
        : estimateSentOrBeyond
        ? "complete"
        : publicStatus === "Estimate In Progress"
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
        : publicStatus === "Awaiting Deposit"
        ? "current"
        : "pending",
    },
    {
      label: "Construction",
      status: constructionComplete
        ? "complete"
        : constructionActive
        ? "current"
        : "pending",
      detail: publicStatus.includes("Construction") ? publicStatus : undefined,
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

function formatPublicStatus(value: string | null | undefined) {
  if (!value) return "Processing";

  const normalized = value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const map: Record<string, string> = {
    "Membership Needed": "Application Received",
    "Site Fee Needed": "Site Visit Fee Needed",
    "Site Visit Needed": "Site Visit Scheduling",
    "Estimate Needed": "Estimate In Progress",
    "Awaiting Deposit": "Awaiting Deposit",
    "Ready For Construction": "Ready For Construction",
    "Waiting On Material": "Construction Delayed",
    "Waiting On Materials": "Construction Delayed",
    "Waiting On Member": "Waiting On Member Information",
    "In Construction": "Construction In Progress",
    "Waiting On Inspection": "Inspection Pending",
    "Final Billing": "Final Billing",
    "Closed Energized": "Service Energized",
  };

  return map[normalized] || normalized;
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
  return new Date(value).toLocaleString();
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

const sectionStyle: React.CSSProperties = {
  marginTop: "32px",
  maxWidth: "900px",
  background: "#fffaf0",
  color: "#111111",
  border: "1px solid #d8c8a3",
  borderRadius: "14px",
  padding: "18px",
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
