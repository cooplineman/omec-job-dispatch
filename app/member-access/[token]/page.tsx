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

type JobDocument = {
  id: string;
  job_number: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  created_at: string;
};

export default function MemberAccessPage({
  params,
}: {
  params: { token: string };
}) {
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [selectedJobNumber, setSelectedJobNumber] = useState("");
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [signedFileUrls, setSignedFileUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [uploading, setUploading] = useState(false);
  const [memberDocumentType, setMemberDocumentType] = useState("site_photo");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.job_number === selectedJobNumber) || jobs[0],
    [jobs, selectedJobNumber]
  );

  const timeline = useMemo(
    () => buildMemberTimeline(selectedJob || null),
    [selectedJob]
  );

  const selectedDocuments = useMemo(
    () =>
      selectedJob
        ? documents.filter((document) => document.job_number === selectedJob.job_number)
        : [],
    [documents, selectedJob]
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
        setDocuments([]);
        setSignedFileUrls({});
      } else {
        const loadedJobs = (data || []) as MemberJob[];
        setJobs(loadedJobs);

        if (loadedJobs.length > 0) {
          setSelectedJobNumber(loadedJobs[0].job_number);
          await loadDocuments(params.token);
        }
      }

      setLoading(false);
    }

    loadAccess();
  }, [params.token]);

  async function loadDocuments(token: string) {
    const { data, error } = await supabase.rpc(
      "get_member_documents_by_access_token",
      { p_token: token }
    );

    if (error) {
      setMessage(`Unable to load member documents: ${error.message}`);
      setDocuments([]);
      setSignedFileUrls({});
      return;
    }

    const loadedDocuments = (data || []) as JobDocument[];
    setDocuments(loadedDocuments);

    if (loadedDocuments.length === 0) {
      setSignedFileUrls({});
      return;
    }

    const paths = loadedDocuments.map((document) => document.storage_path);

    const { data: signedData, error: signedError } = await supabase.storage
      .from("job-documents")
      .createSignedUrls(paths, 60 * 60);

    if (signedError) {
      setMessage(`Unable to prepare document links: ${signedError.message}`);
      setSignedFileUrls({});
      return;
    }

    const urlMap: Record<string, string> = {};

    signedData?.forEach((signedFile, index) => {
      if (signedFile.signedUrl) {
        urlMap[paths[index]] = signedFile.signedUrl;
      }
    });

    setSignedFileUrls(urlMap);
  }

  async function uploadMemberDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedJob || !selectedFile) {
      setMessage("Choose a file first.");
      return;
    }

    setUploading(true);
    setMessage("");

    const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${selectedJob.job_number}/member-${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(storagePath, selectedFile);

    if (uploadError) {
      setMessage(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error } = await supabase.rpc("add_member_document_by_access_token", {
      p_token: params.token,
      p_job_number: selectedJob.job_number,
      p_document_type: memberDocumentType,
      p_file_name: selectedFile.name,
      p_storage_path: storagePath,
    });

    if (error) {
      setMessage(`Upload saved but record failed: ${error.message}`);
    } else {
      setSelectedFile(null);
      setMessage("Upload received. Thank you.");
      await loadDocuments(params.token);
    }

    setUploading(false);
  }

  if (loading) {
    return (
      <main style={shellStyle}>
        <div style={loadingCardStyle}>Loading your service request...</div>
      </main>
    );
  }

  if (message && jobs.length === 0) {
    return (
      <main style={shellStyle}>
        <aside style={sidebarStyle}>
          <BrandBlock />
        </aside>
        <section style={contentStyle}>
          <div style={cardStyle}>
            <h1 style={titleStyle}>Access Link Unavailable</h1>
            <p style={mutedStyle}>
              This service request link is expired, invalid, or no longer active.
              Please contact OMEC if you need a new link.
            </p>
            <p style={alertStyle}>{message}</p>
          </div>
        </section>
      </main>
    );
  }

  if (!selectedJob) {
    return (
      <main style={shellStyle}>
        <aside style={sidebarStyle}>
          <BrandBlock />
        </aside>
        <section style={contentStyle}>
          <div style={cardStyle}>
            <h1 style={titleStyle}>No Service Request Found</h1>
            <p style={mutedStyle}>
              No service request is currently available for this access link.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <aside style={sidebarStyle}>
        <BrandBlock />

        <nav style={navStyle}>
          <a href="#overview" style={{ ...navItemStyle, ...activeNavStyle }}>
            <span style={navIconStyle}>⌂</span> Overview
          </a>
          <a href="#documents" style={navItemStyle}>
            <span style={navIconStyle}>□</span> Documents
          </a>
          <a href="#uploads" style={navItemStyle}>
            <span style={navIconStyle}>⇧</span> Uploads
          </a>
          <a href="#help" style={navItemStyle}>
            <span style={navIconStyle}>?</span> Help
          </a>
        </nav>

        <div style={sideHelpCardStyle}>
          <div style={sideHelpIconStyle}>☏</div>
          <h3 style={{ margin: "8px 0" }}>Need Help?</h3>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            We are here to help. Please contact OMEC with any questions.
          </p>
        </div>

        <div style={sidebarFooterStyle}>
          © 2026 Oneida-Madison<br />
          Electric Cooperative, Inc.
        </div>
      </aside>

      <section style={contentStyle}>
        <div style={secureBadgeStyle}>▣ Secure Member Access</div>

        <header id="overview" style={heroStyle}>
          <div>
            <p style={welcomeStyle}>Welcome,</p>
            <h1 style={titleStyle}>Your Service Request</h1>
            <p style={subtitleStyle}>Here is the latest update on your project.</p>
          </div>
          <div style={heroArtStyle} />
        </header>

        {jobs.length > 1 && (
          <div style={cardStyle}>
            <label style={labelStyle}>
              Select Service Request
              <select
                value={selectedJob.job_number}
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
          </div>
        )}

        <section style={infoStripStyle}>
          <InfoTile icon="▣" label="Job Number" value={selectedJob.job_number} />
          <InfoTile
            icon="⌖"
            label="Location"
            value={`${selectedJob.service_address_line1}${selectedJob.city ? `, ${selectedJob.city}` : ""}`}
          />
          <InfoTile icon="▣" label="Submitted" value={formatShortDate(selectedJob.created_at)} />
          <InfoTile icon="◎" label="Member" value={selectedJob.applicant_name} />
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Project Status</h2>
            <span style={updatedBadgeStyle}>Updated {formatShortDate(selectedJob.updated_at)}</span>
          </div>

          <div style={statusTrackStyle}>
            {timeline.map((step, index) => (
              <div key={step.label} style={trackStepStyle}>
                {index < timeline.length - 1 && <div style={trackLineStyle} />}
                <div style={getTrackCircleStyle(step.status)}>
                  {getTrackSymbol(step.status)}
                </div>
                <div style={trackLabelStyle}>{step.label}</div>
                <div style={trackDetailStyle}>{step.detail || getStatusWord(step.status)}</div>
              </div>
            ))}
          </div>

          <div style={statusMessageStyle}>
            <strong>{formatPublicStatus(selectedJob.public_status)}</strong>
            <br />
            {getFriendlyStatusMessage(selectedJob)}
          </div>
        </section>

        <section style={twoColumnStyle}>
          <div style={metricCardStyle}>
            <div style={metricIconStyle}>$</div>
            <div>
              <div style={metricLabelStyle}>Estimate</div>
              <div style={metricValueStyle}>{formatEstimate(selectedJob)}</div>
              <div style={mutedStyle}>Estimated Total</div>
            </div>
          </div>

          <div style={metricCardStyle}>
            <div style={metricIconStyle}>▣</div>
            <div>
              <div style={metricLabelStyle}>Deposit</div>
              <div style={metricValueStyle}>{formatDeposit(selectedJob)}</div>
              <div style={mutedStyle}>Deposit Status</div>
            </div>
          </div>
        </section>

        <section id="documents" style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Documents</h2>
            <span style={updatedBadgeStyle}>{selectedDocuments.length} file(s)</span>
          </div>

          <div style={documentFilterStyle}>
            <span style={filterPillActiveStyle}>All</span>
            <span style={filterPillStyle}>Site Photos</span>
            <span style={filterPillStyle}>Construction Photos</span>
            <span style={filterPillStyle}>Inspection Docs</span>
            <span style={filterPillStyle}>Estimates</span>
          </div>

          {selectedDocuments.length === 0 ? (
            <p style={emptyStateStyle}>
              No public documents are available for this service request yet.
            </p>
          ) : (
            <div style={documentGridStyle}>
              {selectedDocuments.map((document) => {
                const fileUrl = signedFileUrls[document.storage_path];

                return (
                  <article key={document.id} style={documentCardStyle}>
                    <a
                      href={fileUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={documentPreviewLinkStyle}
                    >
                      {isImageDocument(document.file_name) && fileUrl ? (
                        <img
                          src={fileUrl}
                          alt={document.file_name}
                          style={thumbnailStyle}
                        />
                      ) : (
                        <div style={pdfTileStyle}>PDF</div>
                      )}
                    </a>

                    <div style={documentMetaStyle}>
                      <div style={documentDateStyle}>{formatShortDate(document.created_at)}</div>
                      <div style={documentNameStyle}>{formatDocumentType(document.document_type)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section id="uploads" style={cardStyle}>
          <h2 style={sectionTitleStyle}>Upload a Photo or Document</h2>
          <p style={mutedStyle}>
            Share site/construction photos or inspection documents with OMEC.
          </p>

          <form onSubmit={uploadMemberDocument} style={uploadGridStyle}>
            <label style={uploadOptionStyle}>
              <span style={uploadIconStyle}>▧</span>
              <span>
                <strong>Upload Type</strong>
                <select
                  value={memberDocumentType}
                  onChange={(event) => setMemberDocumentType(event.target.value)}
                  style={inputStyle}
                >
                  <option value="site_photo">Site Photo</option>
                  <option value="construction_photo">Construction Photo</option>
                  <option value="inspection">Inspection</option>
                </select>
              </span>
            </label>

            <label style={uploadOptionStyle}>
              <span style={uploadIconStyle}>⇧</span>
              <span>
                <strong>Choose File</strong>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  style={fileInputStyle}
                />
                <span style={mutedStyle}>
                  {selectedFile ? selectedFile.name : "JPG, PNG, or PDF"}
                </span>
              </span>
            </label>

            <button type="submit" disabled={uploading} style={primaryButtonStyle}>
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </form>

          {message && <p style={alertStyle}>{message}</p>}
        </section>

        <section id="help" style={supportCardStyle}>
          <div>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>
              Questions about your project?
            </h2>
            <p style={{ ...mutedStyle, marginBottom: 0 }}>
              Our team is here to help. Please contact OMEC and reference job{" "}
              <strong>{selectedJob.job_number}</strong>.
            </p>
          </div>
          <a href="mailto:office@oneidamadison.com" style={contactButtonStyle}>
            Contact Us
          </a>
        </section>

        <footer style={pageFooterStyle}>Secure • Private • Trusted</footer>
      </section>
    </main>
  );
}

function BrandBlock() {
  return (
    <div style={brandBlockStyle}>
      <Image
        src="/omec-logo.png"
        alt="OMEC logo"
        width={150}
        height={150}
        style={brandLogoStyle}
      />
      <h2 style={brandTitleStyle}>
        Oneida-Madison<br />
        Electric Cooperative, Inc.
      </h2>
      <div style={estStyle}>Est. 1942</div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={infoTileStyle}>
      <span style={infoIconStyle}>{icon}</span>
      <span>
        <div style={infoLabelStyle}>{label}</div>
        <div style={infoValueStyle}>{value}</div>
      </span>
    </div>
  );
}

function buildMemberTimeline(job: MemberJob | null): TimelineStep[] {
  if (!job) return [];

  const publicStatus = formatPublicStatus(job.public_status);
  const estimateNotRequired = Number(job.estimate_amount ?? -1) === 0;
  const depositNotRequired = Number(job.deposit_required ?? -1) === 0;
  const membershipComplete = !["Application Received", "Membership Needed"].includes(publicStatus);
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

  const constructionComplete = ["Inspection Pending", "Final Billing", "Service Energized"].includes(publicStatus);
  const inspectionReached = ["Inspection Pending", "Final Billing", "Service Energized"].includes(publicStatus);
  const serviceEnergized = publicStatus === "Service Energized";

  return [
    { label: "Received", status: "complete", detail: formatShortDate(job.created_at) },
    {
      label: "Membership",
      status: membershipComplete ? "complete" : "current",
      detail: membershipComplete ? "Complete" : "In progress",
    },
    {
      label: "Site Visit",
      status: siteVisitComplete ? "complete" : publicStatus === "Site Visit Scheduling" ? "current" : "pending",
      detail: siteVisitComplete ? formatShortDate(job.site_visit_at) : "Pending",
    },
    {
      label: estimateNotRequired ? "Estimate N/A" : "Estimate",
      status: estimateNotRequired ? "not_required" : estimateSentOrBeyond ? "complete" : publicStatus === "Estimate In Progress" ? "current" : "pending",
      detail: estimateNotRequired ? "Not required" : getStatusWord(estimateSentOrBeyond ? "complete" : "pending"),
    },
    {
      label: depositNotRequired ? "Deposit N/A" : "Deposit",
      status: depositNotRequired ? "not_required" : Number(job.deposit_received ?? 0) >= Number(job.deposit_required ?? 0) ? "complete" : publicStatus === "Awaiting Deposit" ? "current" : "pending",
      detail: depositNotRequired ? "Not required" : getStatusWord(Number(job.deposit_received ?? 0) >= Number(job.deposit_required ?? 0) ? "complete" : "pending"),
    },
    {
      label: "Construction",
      status: constructionComplete ? "complete" : constructionActive ? "current" : "pending",
      detail: constructionActive ? publicStatus : getStatusWord(constructionComplete ? "complete" : "pending"),
    },
    {
      label: "Inspection",
      status: inspectionReached ? (serviceEnergized ? "complete" : "current") : "pending",
      detail: inspectionReached ? "In review" : "Pending",
    },
    {
      label: "Completed",
      status: serviceEnergized ? "complete" : "pending",
      detail: serviceEnergized ? "Energized" : "Pending",
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

function getTrackSymbol(status: TimelineStep["status"]) {
  if (status === "complete") return "✓";
  if (status === "current") return "●";
  if (status === "not_required") return "—";
  return "○";
}

function getStatusWord(status: TimelineStep["status"]) {
  if (status === "complete") return "Complete";
  if (status === "current") return "Current";
  if (status === "not_required") return "Not required";
  return "Pending";
}

function getFriendlyStatusMessage(job: MemberJob) {
  const status = formatPublicStatus(job.public_status);

  if (status.includes("Construction")) {
    return "Your project is in the construction phase.";
  }

  if (status.includes("Deposit")) {
    return "A deposit is needed before the project can move forward.";
  }

  if (status.includes("Estimate")) {
    return "OMEC is preparing or reviewing the estimate for your project.";
  }

  if (status.includes("Site Visit")) {
    return "A site visit is being scheduled or prepared.";
  }

  if (status.includes("Energized")) {
    return "Your service request has been completed.";
  }

  return "We are processing your service request.";
}

function formatEstimate(job: MemberJob) {
  if (job.estimate_amount === null) return "Pending";
  if (Number(job.estimate_amount) === 0) return "Not Required";
  return `$${Number(job.estimate_amount).toFixed(2)}`;
}

function formatDeposit(job: MemberJob) {
  if (Number(job.deposit_required ?? 0) === 0) return "Not Required";

  return `$${Number(job.deposit_received ?? 0).toFixed(2)} / $${Number(
    job.deposit_required ?? 0
  ).toFixed(2)}`;
}

function formatShortDate(value: string | null) {
  if (!value) return "Pending";

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDocumentType(value: string | null | undefined) {
  if (!value) return "Document";

  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isImageDocument(fileName: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
}

function getTrackCircleStyle(status: TimelineStep["status"]): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "58px",
    height: "58px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    fontSize: "24px",
    fontWeight: 800,
    position: "relative",
    zIndex: 2,
    margin: "0 auto 10px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
  };

  if (status === "complete") {
    return { ...base, background: "#21843b", color: "#ffffff" };
  }

  if (status === "current") {
    return { ...base, background: "#2f9349", color: "#ffffff" };
  }

  if (status === "not_required") {
    return { ...base, background: "#eef4ef", color: "#52715d", border: "1px solid #d7e2da" };
  }

  return { ...base, background: "#f2f3f2", color: "#58635b", border: "1px solid #d8ddda" };
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  background: "#f6f8f5",
  color: "#071f14",
  fontFamily: "Arial, sans-serif",
};

const sidebarStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #003c25 0%, #00552d 42%, #002c1d 100%)",
  color: "#ffffff",
  padding: "28px 22px",
  position: "sticky",
  top: 0,
  height: "100vh",
  overflow: "hidden",
};

const contentStyle: React.CSSProperties = {
  padding: "36px",
  maxWidth: "1040px",
  width: "100%",
};

const brandBlockStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "34px",
};

const brandLogoStyle: React.CSSProperties = {
  borderRadius: "999px",
  border: "3px solid rgba(255,255,255,0.8)",
  background: "#fffaf0",
  objectFit: "contain",
  boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
};

const brandTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  lineHeight: 1.35,
  margin: "16px 0 6px",
};

const estStyle: React.CSSProperties = {
  opacity: 0.8,
  fontSize: "14px",
};

const navStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const navItemStyle: React.CSSProperties = {
  color: "#ffffff",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px 16px",
  borderRadius: "12px",
  fontWeight: 700,
};

const activeNavStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #2f9349, #1f7b39)",
  boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
};

const navIconStyle: React.CSSProperties = {
  width: "22px",
  display: "inline-grid",
  placeItems: "center",
};

const sideHelpCardStyle: React.CSSProperties = {
  marginTop: "42px",
  padding: "22px",
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: "18px",
  textAlign: "center",
  background: "rgba(255,255,255,0.06)",
};

const sideHelpIconStyle: React.CSSProperties = {
  fontSize: "32px",
};

const sidebarFooterStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "28px",
  left: "22px",
  right: "22px",
  fontSize: "13px",
  opacity: 0.75,
  textAlign: "center",
  lineHeight: 1.6,
};

const secureBadgeStyle: React.CSSProperties = {
  float: "right",
  color: "#0b6c32",
  fontWeight: 800,
  fontSize: "14px",
};

const heroStyle: React.CSSProperties = {
  minHeight: "150px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
  marginBottom: "22px",
};

const heroArtStyle: React.CSSProperties = {
  flex: "0 0 280px",
  height: "130px",
  borderRadius: "22px",
  background:
    "linear-gradient(135deg, rgba(33,132,59,0.12), rgba(33,132,59,0.02)), radial-gradient(circle at 80% 20%, rgba(33,132,59,0.26), transparent 36%)",
};

const welcomeStyle: React.CSSProperties = {
  color: "#176b36",
  fontWeight: 800,
  fontSize: "22px",
  margin: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: "46px",
  lineHeight: 1,
  margin: "8px 0 12px",
  letterSpacing: "-1px",
  color: "#072719",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "18px",
  margin: 0,
  color: "#4d5a53",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "18px",
  padding: "22px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
  marginBottom: "20px",
};

const infoStripStyle: React.CSSProperties = {
  ...cardStyle,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
};

const infoTileStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  minWidth: 0,
};

const infoIconStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  background: "#edf6ef",
  display: "grid",
  placeItems: "center",
  color: "#176b36",
  fontWeight: 800,
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#65706a",
  fontWeight: 700,
};

const infoValueStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#071f14",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "18px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  margin: "0 0 12px",
  color: "#071f14",
};

const updatedBadgeStyle: React.CSSProperties = {
  fontSize: "12px",
  border: "1px solid #dfe7e2",
  borderRadius: "999px",
  padding: "7px 10px",
  color: "#3d5145",
  background: "#fbfdfb",
};

const statusTrackStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
  gap: "10px",
  marginBottom: "22px",
};

const trackStepStyle: React.CSSProperties = {
  position: "relative",
  textAlign: "center",
  minHeight: "122px",
};

const trackLineStyle: React.CSSProperties = {
  position: "absolute",
  top: "29px",
  left: "50%",
  right: "-50%",
  height: "3px",
  background: "#d9dfdc",
  zIndex: 1,
};

const trackLabelStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "13px",
};

const trackDetailStyle: React.CSSProperties = {
  color: "#64716a",
  fontSize: "12px",
  marginTop: "4px",
};

const statusMessageStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "14px",
  background: "#f0f8f1",
  border: "1px solid #d6e9da",
  color: "#163f26",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "18px",
  marginBottom: "20px",
};

const metricCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "flex",
  alignItems: "center",
  gap: "18px",
  marginBottom: 0,
};

const metricIconStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "999px",
  background: "#21843b",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  fontSize: "28px",
  fontWeight: 800,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#5f6b64",
  fontWeight: 700,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 900,
  margin: "4px 0",
};

const documentFilterStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const filterPillStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #dfe5e1",
  background: "#ffffff",
  fontWeight: 700,
  fontSize: "13px",
};

const filterPillActiveStyle: React.CSSProperties = {
  ...filterPillStyle,
  background: "#087234",
  color: "#ffffff",
};

const documentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))",
  gap: "16px",
};

const documentCardStyle: React.CSSProperties = {
  minWidth: 0,
};

const documentPreviewLinkStyle: React.CSSProperties = {
  display: "block",
  height: "146px",
  borderRadius: "14px",
  background: "#f6f7f6",
  border: "1px solid #e1e6e2",
  overflow: "hidden",
  textDecoration: "none",
};

const thumbnailStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const pdfTileStyle: React.CSSProperties = {
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: "#d71920",
  fontWeight: 900,
  fontSize: "26px",
};

const documentMetaStyle: React.CSSProperties = {
  marginTop: "8px",
};

const documentDateStyle: React.CSSProperties = {
  color: "#64716a",
  fontSize: "12px",
};

const documentNameStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "13px",
};

const uploadGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
  alignItems: "end",
};

const uploadOptionStyle: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "center",
  padding: "18px",
  border: "1px dashed #cfd8d2",
  borderRadius: "16px",
  background: "#fbfdfb",
};

const uploadIconStyle: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "999px",
  background: "#e7f3ea",
  display: "grid",
  placeItems: "center",
  color: "#087234",
  fontWeight: 900,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "8px",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d8e0db",
  background: "#ffffff",
};

const fileInputStyle: React.CSSProperties = {
  display: "block",
  marginTop: "8px",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "13px 18px",
  borderRadius: "999px",
  border: "1px solid #003c25",
  background: "#00642f",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const supportCardStyle: React.CSSProperties = {
  ...cardStyle,
  background: "linear-gradient(135deg, #f1f9f2, #ffffff)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
};

const contactButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "10px",
  background: "#00462b",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 800,
};

const pageFooterStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#607168",
  padding: "8px 0 28px",
};

const mutedStyle: React.CSSProperties = {
  color: "#5f6b64",
  fontSize: "14px",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 800,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "16px",
  border: "1px dashed #ccd8d0",
  borderRadius: "14px",
  background: "#fbfdfb",
  color: "#5f6b64",
};

const alertStyle: React.CSSProperties = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "12px",
  background: "#f8fbf8",
  border: "1px solid #d8e5db",
};

const loadingCardStyle: React.CSSProperties = {
  margin: "40px",
  padding: "30px",
  background: "#ffffff",
  borderRadius: "18px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

