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
  estimate_status: string | null;
  site_visit_at: string | null;
  estimate_amount: number | null;
  deposit_required: number | null;
  deposit_received: number | null;
  final_bill_amount: number | null;
  final_payment_received: boolean | null;
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
            <HomeIcon />
            Overview
          </a>
          <a href="#payments" style={navItemStyle}>
            <CircleDollarSignIcon />
            Payments
          </a>
          <a href="#documents" style={navItemStyle}>
            <FolderIcon />
            Documents
          </a>
          <a href="#uploads" style={navItemStyle}>
            <CloudUploadIcon />
            Uploads
          </a>
        </nav>


      </aside>

      <section style={contentStyle}>
        <header id="overview" style={heroStyle}>
          <div>
            <p style={welcomeStyle}>Welcome,</p>
            <h1 style={titleStyle}>{getFirstName(selectedJob.applicant_name)}&apos;s Service Request</h1>
            <p style={subtitleStyle}>Here is the latest update on your project.</p>
          </div>
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
          <InfoTile icon={<FileDigitIcon />} label="Job Number" value={selectedJob.job_number} />
          <InfoTile
            icon={<MapPinHouseIcon />}
            label="Location"
            value={`${selectedJob.service_address_line1}${selectedJob.city ? `, ${selectedJob.city}` : ""}`}
          />
          <InfoTile icon={<PencilLineIcon />} label="Submitted" value={formatShortDate(selectedJob.created_at)} />
          <InfoTile icon={<UserIcon />} label="Member" value={selectedJob.applicant_name} />
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
                  {getTrackSymbol(step.status, step.label)}
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
            <div style={metricIconStyle}>
              <ReceiptIcon />
            </div>
            <div>
              <div style={metricLabelStyle}>Estimate</div>
              <div style={metricValueStyle}>{formatEstimate(selectedJob)}</div>
              <div style={mutedStyle}>Estimated Total</div>
            </div>
          </div>

          <div style={metricCardStyle}>
            <div style={metricIconStyle}>
              <CircleDollarSignIcon />
            </div>
            <div>
              <div style={metricLabelStyle}>Deposit</div>
              <div style={metricValueStyle}>{formatDeposit(selectedJob)}</div>
              <div style={mutedStyle}>Deposit Status</div>
            </div>
          </div>

          <div style={metricCardStyle}>
            <div style={metricIconStyle}>
              <CircleDollarSignIcon />
            </div>
            <div>
              <div style={metricLabelStyle}>{getFinalPaymentLabel(selectedJob)}</div>
              <div style={getFinalPaymentValueStyle(selectedJob)}>{formatFinalPaymentRefund(selectedJob)}</div>
              <div style={mutedStyle}>{getFinalPaymentRefundMessage(selectedJob)}</div>
            </div>
          </div>
        </section>

        <section id="payments" style={paymentCardStyle}>
          <div style={paymentIconStyle}>
            <CircleDollarSignIcon />
          </div>
          <div style={paymentContentStyle}>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Make a Payment</h2>
            <p style={{ ...mutedStyle, margin: "8px 0 0" }}>
              Use SmartHub to pay your site visit fee, deposit, or final payment.
            </p>
          </div>
          <a
            href="https://oneidamadison.smarthub.coop/ui/#/paynow/"
            target="_blank"
            rel="noreferrer"
            style={paymentButtonStyle}
          >
            Pay with SmartHub
          </a>
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

          <form onSubmit={uploadMemberDocument} style={uploadFormStyle}>
            <div style={uploadFieldsStyle}>
              <label style={uploadFieldStyle}>
                <span style={uploadFieldIconStyle}>
                  <FileDigitIcon />
                </span>
                <span style={uploadFieldBodyStyle}>
                  <strong style={uploadFieldLabelStyle}>Upload Type</strong>
                  <select
                    value={memberDocumentType}
                    onChange={(event) => setMemberDocumentType(event.target.value)}
                    style={uploadSelectStyle}
                  >
                    <option value="site_photo">Site Photo</option>
                    <option value="construction_photo">Construction Photo</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </span>
              </label>

              <label style={uploadFieldStyle}>
                <span style={uploadFieldIconStyle}>
                  <CloudUploadIcon />
                </span>
                <span style={uploadFieldBodyStyle}>
                  <strong style={uploadFieldLabelStyle}>Choose File</strong>
                  <span style={filePickerRowStyle}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      style={fileInputStyle}
                    />
                  </span>
                  <span style={fileHintStyle}>
                    {selectedFile ? selectedFile.name : "JPG, PNG, or PDF"}
                  </span>
                </span>
              </label>
            </div>

            <button type="submit" disabled={uploading} style={primaryButtonStyle}>
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </form>

          {message && <p style={alertStyle}>{message}</p>}
        </section>

        <section id="help" style={supportCardStyle}>
          <div style={supportIconStyle}>
            <HelpCircleIcon />
          </div>
          <div style={supportContentStyle}>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>
              Questions about your project?
            </h2>
            <p style={{ ...mutedStyle, margin: "8px 0 0" }}>
              Contact OMEC and reference job <strong>{selectedJob.job_number}</strong>.
            </p>
          </div>
          <a href="mailto:office@oneidamadison.com" style={contactButtonStyle}>
            Contact Us
          </a>
        </section>


      </section>
    </main>
  );
}

function getFirstName(name: string | null | undefined) {
  const cleaned = (name || "").trim();

  if (!cleaned) {
    return "Your";
  }

  return cleaned.split(/\s+/)[0];
}

function HourglassIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 21h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 3c0 4.2 2.4 6.1 5 9-2.6 2.9-5 4.8-5 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 3c0 4.2-2.4 6.1-5 9 2.6 2.9 5 4.8 5 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 17h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function HardHatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 18h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 18v-2a7 7 0 0 1 14 0v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15 9v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 18v2h8v-2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookmarkCheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V21l-6-3-6 3V4.8Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10.5l2 2 4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21V3Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7h6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M9 11h6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M9 15h4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

function CircleDollarSignIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.1" />
      <path d="M12 6.5v11" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M15 8.8c-.7-.7-1.7-1-3-1-1.6 0-2.8.8-2.8 2.1 0 1.4 1.2 1.9 2.8 2.2 1.9.4 3 .9 3 2.3 0 1.3-1.2 2.1-3 2.1-1.4 0-2.6-.4-3.4-1.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 10.8L12 3l9 7.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10.5V20h13v-9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-6h5v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 18.5H7a4 4 0 0 1-.6-7.95A5.8 5.8 0 0 1 17.6 8.9A4.8 4.8 0 0 1 18 18.5h-1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19V12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8.8 15.2L12 12l3.2 3.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileDigitIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13h1.5a1.5 1.5 0 0 1 0 3H10v-6h2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 10v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function MapPinHouseIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 11.5 12 8.5l3.5 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 11v4h5v-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilLineIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}



function HelpCircleIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
      <path d="M9.5 9a2.7 2.7 0 0 1 5.2 1c0 2-2.7 2.1-2.7 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function BrandBlock() {
  return (
    <div style={brandBlockStyle}>
      <Image
        src="/omec-logo.png"
        alt="OMEC logo"
        width={210}
        height={210}
        style={brandLogoStyle}
      />
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
  const inspectionPending = publicStatus === "Inspection Pending";
  const finalBilling = publicStatus === "Final Billing";
  const serviceEnergized = publicStatus === "Service Energized";
  const finalPaymentComplete = Boolean(job.final_payment_received) || serviceEnergized;

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
      detail: estimateNotRequired ? "Not required" : getStatusWord(estimateSentOrBeyond ? "complete" : publicStatus === "Estimate In Progress" ? "current" : "pending"),
    },
    {
      label: depositNotRequired ? "Deposit N/A" : "Deposit",
      status: depositNotRequired ? "not_required" : Number(job.deposit_received ?? 0) >= Number(job.deposit_required ?? 0) ? "complete" : publicStatus === "Awaiting Deposit" ? "current" : "pending",
      detail: depositNotRequired ? "Not required" : getStatusWord(Number(job.deposit_received ?? 0) >= Number(job.deposit_required ?? 0) ? "complete" : publicStatus === "Awaiting Deposit" ? "current" : "pending"),
    },
    {
      label: "Construction",
      status: constructionComplete ? "complete" : constructionActive ? "current" : "pending",
      detail: constructionActive ? publicStatus : getStatusWord(constructionComplete ? "complete" : "pending"),
    },
    {
      label: "Inspection",
      status: serviceEnergized || finalBilling ? "complete" : inspectionPending ? "current" : "pending",
      detail: inspectionPending ? "Waiting on inspection" : serviceEnergized || finalBilling ? "Complete" : "Pending",
    },
    {
      label: getFinalPaymentLabel(job),
      status: finalPaymentComplete ? "complete" : finalBilling ? "current" : "pending",
      detail: finalPaymentComplete ? "Complete" : finalBilling ? "Waiting on final payment" : "Pending",
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

function getTrackSymbol(status: TimelineStep["status"], label?: string) {
  const normalizedLabel = (label || "").toLowerCase();

  if (status === "complete" && normalizedLabel.includes("completed")) {
    return <BookmarkCheckIcon />;
  }

  if (status === "complete") {
    return "✓";
  }

  if (status === "current" && normalizedLabel.includes("construction")) {
    return <HardHatIcon />;
  }

  if (status === "current") {
    return <HourglassIcon />;
  }

  if (status === "not_required") {
    return "✓";
  }

  return <HourglassIcon />;
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

  if (
    status.includes("Estimate") &&
    job.estimate_status === "sent"
  ) {
    return "Estimate sent. Please review, approve, and return the signed estimate.";
  }

  if (status.includes("Estimate")) {
    return "Estimate in progress. OMEC is preparing your estimate.";
  }

  if (status.includes("Inspection")) {
    return "Waiting on inspection. OMEC is waiting for inspection before final completion.";
  }

  if (status.includes("Final Billing")) {
    return getFinalPaymentRefundMessage(job);
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
  const publicStatus = formatPublicStatus(job.public_status);

  const estimatePendingStatuses = [
    "Application Received",
    "Site Visit Fee Needed",
    "Site Visit Scheduling",
  ];

  if (
    estimatePendingStatuses.includes(publicStatus) &&
    job.estimate_status !== "sent"
  ) {
    return "Pending";
  }

  if (job.estimate_amount === null) {
    return "Pending";
  }

  if (Number(job.estimate_amount) === 0) {
    return "Not Required";
  }

  return `$${Number(job.estimate_amount).toFixed(2)}`;
}

function formatDeposit(job: MemberJob) {
  const publicStatus = formatPublicStatus(job.public_status);

  const estimatePendingStatuses = [
    "Application Received",
    "Site Visit Fee Needed",
    "Site Visit Scheduling",
  ];

  if (
    estimatePendingStatuses.includes(publicStatus) &&
    job.estimate_status !== "sent"
  ) {
    return "Pending";
  }

  if (Number(job.deposit_required ?? 0) === 0) {
    return "Not Required";
  }

  return `$${Number(job.deposit_received ?? 0).toFixed(2)} / $${Number(
    job.deposit_required ?? 0
  ).toFixed(2)}`;
}

function hasFinalPaymentAmount(job: MemberJob) {
  return job.final_bill_amount !== null && job.final_bill_amount !== undefined;
}

function getFinalPaymentLabel(job: MemberJob) {
  if (hasFinalPaymentAmount(job) && Number(job.final_bill_amount) < 0) {
    return "Refund";
  }

  return "Final Payment";
}

function formatSignedMoney(value: number) {
  const absoluteValue = Math.abs(value).toFixed(2);

  if (value < 0) {
    return `-$${absoluteValue}`;
  }

  return `$${absoluteValue}`;
}

function formatFinalPaymentRefund(job: MemberJob) {
  const publicStatus = formatPublicStatus(job.public_status);

  const finalStageReached =
    publicStatus === "Final Billing" ||
    publicStatus === "Service Energized" ||
    Boolean(job.final_payment_received);

  if (!finalStageReached) {
    return "Pending";
  }

  if (hasFinalPaymentAmount(job)) {
    return formatSignedMoney(Number(job.final_bill_amount));
  }

  return "Waiting";
}

function getFinalPaymentRefundMessage(job: MemberJob) {
  const publicStatus = formatPublicStatus(job.public_status);
  const estimateAmount = Number(job.estimate_amount ?? 0);
  const depositReceived = Number(job.deposit_received ?? 0);
  const finalAmount = hasFinalPaymentAmount(job)
    ? Number(job.final_bill_amount)
    : null;
  const totalPaidOrDue = finalAmount === null ? null : depositReceived + finalAmount;

  const finalStageReached =
    publicStatus === "Final Billing" ||
    publicStatus === "Service Energized" ||
    Boolean(job.final_payment_received);

  if (!finalStageReached) {
    return "Final billing pending";
  }

  if (finalAmount === null) {
    return "Waiting on final payment amount";
  }

  if (finalAmount < 0) {
    return "OMEC will refund this amount to you.";
  }

  if (estimateAmount > 0 && totalPaidOrDue !== null && totalPaidOrDue < estimateAmount) {
    return "Great news! Your job came in under estimate.";
  }

  if (!job.final_payment_received) {
    return "Waiting on final payment";
  }

  if (estimateAmount > 0 && totalPaidOrDue !== null && totalPaidOrDue > estimateAmount) {
    return "Final total is above estimate. Please contact OMEC with questions.";
  }

  return "Final payment complete";
}

function getFinalPaymentValueStyle(job: MemberJob): React.CSSProperties {
  if (hasFinalPaymentAmount(job) && Number(job.final_bill_amount) < 0) {
    return { ...metricValueStyle, color: "#c81e1e" };
  }

  return metricValueStyle;
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

const appFontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  background: "#f6f8f5",
  color: "#071f14",
  fontFamily: appFontFamily,
};

const sidebarStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(0,40,24,0.35), rgba(0,40,24,0.55)), url('/omec-sidebar-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
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
  marginBottom: "28px",
  color: "#ffffff",
};

const brandLogoStyle: React.CSSProperties = {
  width: "210px",
  height: "210px",
  objectFit: "contain",
  filter: "drop-shadow(0 22px 40px rgba(0,0,0,0.34))",
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
  width: "28px",
  display: "inline-grid",
  placeItems: "center",
  fontSize: "22px",
  lineHeight: 1,
};




const heroStyle: React.CSSProperties = {
  minHeight: "150px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "20px",
  marginBottom: "22px",
};


const welcomeStyle: React.CSSProperties = {
  color: "#176b36",
  fontFamily: appFontFamily,
  fontWeight: 800,
  fontSize: "22px",
  margin: 0,
};

const titleStyle: React.CSSProperties = {
  fontFamily: appFontFamily,
  fontSize: "46px",
  lineHeight: 1.04,
  margin: "8px 0 12px",
  letterSpacing: "-1.2px",
  color: "#072719",
  fontWeight: 850,
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: appFontFamily,
  fontSize: "18px",
  margin: 0,
  color: "#4d5a53",
  fontWeight: 500,
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
  width: "58px",
  height: "58px",
  borderRadius: "999px",
  background: "#edf6ef",
  display: "grid",
  placeItems: "center",
  color: "#21843b",
  fontWeight: 800,
  flex: "0 0 auto",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#65706a",
  fontWeight: 700,
};

const infoValueStyle: React.CSSProperties = {
  fontFamily: appFontFamily,
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
  fontFamily: appFontFamily,
  fontSize: "22px",
  margin: "0 0 12px",
  color: "#071f14",
  fontWeight: 800,
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
  fontFamily: appFontFamily,
  fontSize: "28px",
  fontWeight: 850,
  margin: "4px 0",
  letterSpacing: "-0.4px",
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

const uploadFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "22px",
  alignItems: "stretch",
};

const uploadFieldsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "18px",
};

const uploadFieldStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
  padding: "18px",
  border: "1px solid #d8e3dc",
  borderRadius: "18px",
  background: "#fbfdfb",
  minHeight: "112px",
};

const uploadFieldIconStyle: React.CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "16px",
  background: "#e7f3ea",
  display: "grid",
  placeItems: "center",
  color: "#21843b",
  flex: "0 0 auto",
};

const uploadFieldBodyStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: 0,
  width: "100%",
};

const uploadFieldLabelStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#071f14",
};

const uploadSelectStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "230px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #d8c8a3",
  background: "#ffffff",
  color: "#071f14",
  fontSize: "15px",
  fontWeight: 600,
};

const filePickerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "8px",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d8e0db",
  background: "#ffffff",
  color: "#071f14",
};

const fileInputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "320px",
  fontSize: "14px",
  color: "#31443a",
};

const fileHintStyle: React.CSSProperties = {
  color: "#5f6b64",
  fontSize: "13px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const primaryButtonStyle: React.CSSProperties = {
  minWidth: "180px",
  alignSelf: "stretch",
  padding: "14px 22px",
  borderRadius: "18px",
  border: "1px solid #003c25",
  background: "#006f35",
  color: "#ffffff",
  fontWeight: 850,
  fontSize: "16px",
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(0, 79, 38, 0.18)",
};

const paymentCardStyle: React.CSSProperties = {
  ...cardStyle,
  background: "linear-gradient(135deg, #f1f9f2, #ffffff)",
  display: "grid",
  gridTemplateColumns: "56px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "18px",
  padding: "24px",
};

const paymentIconStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "18px",
  background: "#e7f3ea",
  color: "#21843b",
  display: "grid",
  placeItems: "center",
};

const paymentContentStyle: React.CSSProperties = {
  minWidth: 0,
};

const paymentButtonStyle: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: "14px",
  background: "#21843b",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 850,
  whiteSpace: "nowrap",
  boxShadow: "0 10px 22px rgba(33, 132, 59, 0.18)",
};

const supportCardStyle: React.CSSProperties = {
  ...cardStyle,
  background: "linear-gradient(135deg, #f1f9f2, #ffffff)",
  display: "grid",
  gridTemplateColumns: "56px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "18px",
  padding: "24px",
};

const supportIconStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "18px",
  background: "#e7f3ea",
  color: "#21843b",
  display: "grid",
  placeItems: "center",
};

const supportContentStyle: React.CSSProperties = {
  minWidth: 0,
};

const contactButtonStyle: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: "14px",
  background: "#00462b",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 850,
  whiteSpace: "nowrap",
  boxShadow: "0 10px 22px rgba(0, 70, 43, 0.16)",
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
