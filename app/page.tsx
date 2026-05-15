"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type AppRole = "admin" | "staff" | "viewer";

type DashboardSummary = {
  total_jobs: number;
  open_stop_items: number;
  closed_jobs: number;
};

type JobListItem = {
  job_number: string;
  applicant_name: string;
  member_number: string | null;
  current_stage: string;
  gate_status: string;
  gate_message: string;
  next_action: string;
};

type JobDetail = JobListItem & {
  work_order_number: string | null;
  job_type: string;
  source_intake: string | null;
  inquiry_date: string;
  membership_status: string;
  site_fee_status: string;
  site_visit_at: string | null;
  estimate_status: string;
  estimate_amount: number | null;
  deposit_required: number | null;
  deposit_received: number | null;
  construction_status: string;
  construction_completed_at: string | null;
  inspection_received: boolean;
  inspection_received_at: string | null;
  final_bill_amount: number | null;
  final_payment_received: boolean;
  energized_at: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  email: string | null;
  phone: string | null;
  service_address_line1: string;
  service_address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

type JobDocument = {
  id: string;
  job_number: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  created_at: string;
};

type JobComment = {
  id: string;
  job_number: string;
  visibility: string;
  comment_body: string;
  created_at: string;
};

type JobActivity = {
  id: string;
  job_number: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action_type: string;
  action_label: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type WorkflowUpdates = {
  p_membership_status?: string | null;
  p_site_fee_status?: string | null;
  p_site_visit_at?: string | null;
  p_estimate_status?: string | null;
  p_deposit_required?: number | null;
  p_deposit_received?: number | null;
  p_construction_status?: string | null;
  p_inspection_received?: boolean | null;
  p_inspection_received_at?: string | null;
  p_final_payment_received?: boolean | null;
  p_energized_at?: string | null;
};

type WorkflowAction = {
  id: string;
  label: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<AppRole>("viewer");
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobDetail | null>(
    null
  );
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [signedFileUrls, setSignedFileUrls] = useState<Record<string, string>>(
    {}
  );
  const [comments, setComments] = useState<JobComment[]>([]);
  const [activities, setActivities] = useState<JobActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingComment, setAddingComment] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedJobNumber, setSelectedJobNumber] = useState("");
  const [message, setMessage] = useState("");
  const [documentType, setDocumentType] = useState("site_photo");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const [searchText, setSearchText] = useState("");
  const [gateFilter, setGateFilter] = useState("all");

  const [siteVisitDate, setSiteVisitDate] = useState("05-20-2026");
  const [inspectionDate, setInspectionDate] = useState("05-21-2026");
  const [energizedDate, setEnergizedDate] = useState("05-22-2026");

  const [depositRequired, setDepositRequired] = useState("0");
  const [depositReceived, setDepositReceived] = useState("0");

  const [form, setForm] = useState({
    applicantName: "",
    memberNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "OK",
    postalCode: "",
    jobType: "new_service",
  });

  const selectedJob = jobs.find((job) => job.job_number === selectedJobNumber);
  const nextActions = getNextActions(selectedJob);

  const isAdmin = userRole === "admin";
  const canEdit = userRole === "admin" || userRole === "staff";

  const filteredJobs = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return jobs.filter((job) => {
      const matchesSearch =
        !search ||
        job.job_number.toLowerCase().includes(search) ||
        job.applicant_name.toLowerCase().includes(search) ||
        (job.member_number || "").toLowerCase().includes(search) ||
        job.current_stage.toLowerCase().includes(search) ||
        job.gate_message.toLowerCase().includes(search) ||
        job.next_action.toLowerCase().includes(search);

      const matchesGate =
        gateFilter === "all" || job.gate_status === gateFilter;

      return matchesSearch && matchesGate;
    });
  }, [jobs, searchText, gateFilter]);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;

      setUser(sessionUser);
      setAuthLoading(false);

      if (sessionUser) {
        loadUserRole();
      }
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          loadUserRole();
        } else {
          setUserRole("viewer");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboard();
    } else {
      setSummary(null);
      setJobs([]);
      setSelectedJobNumber("");
      setSelectedJobDetail(null);
      setDocuments([]);
      setSignedFileUrls({});
      setComments([]);
      setActivities([]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSelectedJobData(selectedJobNumber);
    }
  }, [selectedJobNumber, user]);

  async function loadUserRole() {
    const { data, error } = await supabase
      .from("current_user_profile")
      .select("role")
      .single();

    if (error || !data?.role) {
      setUserRole("viewer");
      return;
    }

    setUserRole(data.role as AppRole);
  }

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

  async function loadDashboard() {
    setLoading(true);

    const { data: summaryData, error: summaryError } = await supabase
      .from("job_dashboard_summary")
      .select("*")
      .single();

    const { data: jobsData, error: jobsError } = await supabase
      .from("job_list_view")
      .select("*");

    if (summaryError || jobsError) {
      setMessage(
        summaryError?.message || jobsError?.message || "Error loading data"
      );
    } else {
      setSummary(summaryData);
      setJobs(jobsData || []);
    }

    setLoading(false);
  }

  async function loadSelectedJobData(jobNumber: string) {
    if (!jobNumber) {
      setSelectedJobDetail(null);
      setDocuments([]);
      setSignedFileUrls({});
      setComments([]);
      setActivities([]);
      return;
    }

    const { data: detailData, error: detailError } = await supabase
      .from("job_detail_view")
      .select("*")
      .eq("job_number", jobNumber)
      .single();

    const { data: documentData, error: documentError } = await supabase
      .from("job_documents_view")
      .select("*")
      .eq("job_number", jobNumber);

    const { data: commentData, error: commentError } = await supabase
      .from("job_comments_view")
      .select("*")
      .eq("job_number", jobNumber);

    const { data: activityData, error: activityError } = await supabase
      .from("job_activity_log_view")
      .select("*")
      .eq("job_number", jobNumber);

    if (detailError || documentError || commentError || activityError) {
      setMessage(
        detailError?.message ||
          documentError?.message ||
          commentError?.message ||
          activityError?.message ||
          "Error loading selected job"
      );
    } else {
      const loadedDocuments = documentData || [];

      setSelectedJobDetail(detailData);
      setDocuments(loadedDocuments);
      setComments(commentData || []);
      setActivities(activityData || []);

      await loadSignedFileUrls(loadedDocuments);

      setDepositRequired(String(detailData.deposit_required ?? 0));
      setDepositReceived(String(detailData.deposit_received ?? 0));
    }
  }

  async function loadSignedFileUrls(loadedDocuments: JobDocument[]) {
    if (loadedDocuments.length === 0) {
      setSignedFileUrls({});
      return;
    }

    const paths = loadedDocuments.map((document) => document.storage_path);

    const { data, error } = await supabase.storage
      .from("job-documents")
      .createSignedUrls(paths, 60 * 60);

    if (error) {
      setMessage(`Error creating secure file links: ${error.message}`);
      setSignedFileUrls({});
      return;
    }

    const urlMap: Record<string, string> = {};

    data?.forEach((signedFile, index) => {
      if (signedFile.signedUrl) {
        urlMap[paths[index]] = signedFile.signedUrl;
      }
    });

    setSignedFileUrls(urlMap);
  }

  async function createJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setMessage("You do not have permission to create jobs.");
      return;
    }

    setCreating(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "create_job_with_member_auto_number",
      {
        p_applicant_name: form.applicantName,
        p_member_number: form.memberNumber || null,
        p_email: form.email || null,
        p_phone: form.phone || null,
        p_service_address_line1: form.address,
        p_city: form.city || null,
        p_state: form.state || null,
        p_postal_code: form.postalCode || null,
        p_job_type: form.jobType,
        p_source_intake: "web_app",
      }
    );

    if (error) {
      setMessage(`Error creating job: ${error.message}`);
    } else {
      const newJobNumber = data?.[0]?.job_number;
      setMessage(`Created job ${newJobNumber}`);

      setForm({
        applicantName: "",
        memberNumber: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "OK",
        postalCode: "",
        jobType: "new_service",
      });

      setShowCreateForm(false);
      await loadDashboard();

      if (newJobNumber) {
        setSelectedJobNumber(newJobNumber);
      }
    }

    setCreating(false);
  }

  async function updateWorkflow(label: string, updates: WorkflowUpdates) {
    if (!canEdit) {
      setMessage("You do not have permission to update jobs.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    setUpdating(true);
    setMessage("");

    const { error } = await supabase.rpc("update_job_workflow_status", {
      p_job_number: selectedJobNumber,
      p_membership_status: updates.p_membership_status ?? null,
      p_site_fee_status: updates.p_site_fee_status ?? null,
      p_site_visit_at: updates.p_site_visit_at ?? null,
      p_estimate_status: updates.p_estimate_status ?? null,
      p_deposit_required: updates.p_deposit_required ?? null,
      p_deposit_received: updates.p_deposit_received ?? null,
      p_construction_status: updates.p_construction_status ?? null,
      p_inspection_received: updates.p_inspection_received ?? null,
      p_inspection_received_at: updates.p_inspection_received_at ?? null,
      p_final_payment_received: updates.p_final_payment_received ?? null,
      p_energized_at: updates.p_energized_at ?? null,
    });

    if (error) {
      setMessage(`Error updating job: ${error.message}`);
    } else {
      setMessage(`Updated ${selectedJobNumber}: ${label}`);
      await loadDashboard();
      await loadSelectedJobData(selectedJobNumber);
    }

    setUpdating(false);
  }

  async function resetJobToStage(targetStage: string, label: string) {
    if (!isAdmin) {
      setMessage("Only admins can use correction tools.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    const confirmed = window.confirm(
      `Reset ${selectedJobNumber} to "${label}"? This will clear later workflow fields.`
    );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setMessage("");

    const { error } = await supabase.rpc("reset_job_to_stage", {
      p_job_number: selectedJobNumber,
      p_target_stage: targetStage,
    });

    if (error) {
      setMessage(`Error resetting job: ${error.message}`);
    } else {
      setMessage(`Reset ${selectedJobNumber} to ${label}`);
      await loadDashboard();
      await loadSelectedJobData(selectedJobNumber);
    }

    setUpdating(false);
  }

  async function handleWorkflowAction(action: WorkflowAction) {
    const updates = buildWorkflowUpdates(action.id);

    if (!updates) {
      return;
    }

    await updateWorkflow(action.label, updates);
  }

  function buildWorkflowUpdates(actionId: string): WorkflowUpdates | null {
    if (actionId === "membership_complete") {
      return { p_membership_status: "completed" };
    }

    if (actionId === "site_fee_paid") {
      return { p_site_fee_status: "paid" };
    }

    if (actionId === "set_site_visit") {
      const isoDate = mmDdYyyyToIso(siteVisitDate, 13);

      if (!isoDate) {
        setMessage("Enter Site Visit Date in MM-DD-YYYY format.");
        return null;
      }

      return { p_site_visit_at: isoDate };
    }

    if (actionId === "estimate_signed") {
      const required = parseMoney(depositRequired);
      const received = parseMoney(depositReceived);

      if (required === null || received === null) {
        setMessage("Enter valid deposit amounts, such as 2500 or 2500.00.");
        return null;
      }

      return {
        p_estimate_status: "signed",
        p_deposit_required: required,
        p_deposit_received: received,
      };
    }

    if (actionId === "deposit_received") {
      const received = parseMoney(depositReceived);

      if (received === null) {
        setMessage("Enter a valid Deposit Received amount.");
        return null;
      }

      return {
        p_deposit_received: received,
      };
    }

    if (actionId === "construction_in_progress") {
      return { p_construction_status: "in_progress" };
    }

    if (actionId === "construction_complete") {
      return { p_construction_status: "completed" };
    }

    if (actionId === "inspection_received") {
      const isoDate = mmDdYyyyToIso(inspectionDate, 15);

      if (!isoDate) {
        setMessage("Enter Inspection Date in MM-DD-YYYY format.");
        return null;
      }

      return {
        p_inspection_received: true,
        p_inspection_received_at: isoDate,
      };
    }

    if (actionId === "final_payment_received") {
      return { p_final_payment_received: true };
    }

    if (actionId === "energized_closed") {
      const isoDate = mmDdYyyyToIso(energizedDate, 14);

      if (!isoDate) {
        setMessage("Enter Energized Date in MM-DD-YYYY format.");
        return null;
      }

      return { p_energized_at: isoDate };
    }

    setMessage("Unknown workflow action.");
    return null;
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setMessage("You do not have permission to upload files.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    if (!selectedFile) {
      setMessage("Choose a file or photo first.");
      return;
    }

    setUploading(true);
    setMessage("");

    const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${selectedJobNumber}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(storagePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setMessage(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: recordError } = await supabase.rpc(
      "add_job_document_by_number",
      {
        p_job_number: selectedJobNumber,
        p_document_type: documentType,
        p_file_name: selectedFile.name,
        p_storage_path: storagePath,
      }
    );

    if (recordError) {
      setMessage(
        `File uploaded, but document record failed: ${recordError.message}`
      );
    } else {
      setMessage(`Uploaded ${selectedFile.name} to ${selectedJobNumber}`);
      setSelectedFile(null);
      await loadSelectedJobData(selectedJobNumber);
    }

    setUploading(false);
  }
  function printJobPacket() {
    window.print();
  }
  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setMessage("You do not have permission to add notes.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    if (!commentBody.trim()) {
      setMessage("Enter a note first.");
      return;
    }

    setAddingComment(true);
    setMessage("");

    const { error } = await supabase.rpc("add_job_comment_by_number", {
      p_job_number: selectedJobNumber,
      p_comment_body: commentBody.trim(),
      p_visibility: "internal",
    });

    if (error) {
      setMessage(`Error adding note: ${error.message}`);
    } else {
      setMessage(`Added note to ${selectedJobNumber}`);
      setCommentBody("");
      await loadSelectedJobData(selectedJobNumber);
    }

    setAddingComment(false);
  }

  if (authLoading) {
    return (
      <main style={mainStyle}>
        <h1>OMEC Job Dispatch</h1>
        <p>Checking login...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={mainStyle}>
        <h1>OMEC Job Dispatch</h1>
        <p>Please log in to continue.</p>

        {message && <p style={messageStyle}>{message}</p>}

        <section style={sectionStyle}>
          <form onSubmit={signIn} style={panelStyle}>
            <h2>Login</h2>

            <FormInput
              label="Email"
              value={loginEmail}
              required
              onChange={setLoginEmail}
            />

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
        <div>
          <h1 style={{ marginBottom: "4px" }}>OMEC Job Dispatch</h1>
          <p style={{ marginTop: 0 }}>Staff dashboard connected to Supabase.</p>
          <p style={{ marginTop: 0, fontSize: "14px" }}>
            Logged in as <strong>{user.email}</strong> — Role:{" "}
            <strong>{userRole}</strong>
          </p>
        </div>

        <button type="button" onClick={signOut} style={secondaryButtonStyle}>
          Log Out
        </button>
      </div>

      {message && <p style={messageStyle}>{message}</p>}

      <section style={dashboardGridStyle}>
        <DashboardCard title="Total Jobs" value={summary?.total_jobs ?? 0} />
        <DashboardCard
          title="Open STOP Items"
          value={summary?.open_stop_items ?? 0}
        />
        <DashboardCard title="Closed Jobs" value={summary?.closed_jobs ?? 0} />
      </section>

      {canEdit && (
        <section style={sectionStyle}>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={buttonStyle}
          >
            {showCreateForm ? "Hide Create Job Form" : "Create New Job"}
          </button>

          {showCreateForm && (
            <div style={panelStyle}>
              <h2>Create New Job</h2>

              <form onSubmit={createJob}>
                <FormInput
                  label="Applicant Name"
                  value={form.applicantName}
                  required
                  onChange={(value) =>
                    setForm({ ...form, applicantName: value })
                  }
                />

                <FormInput
                  label="Member Number"
                  value={form.memberNumber}
                  onChange={(value) =>
                    setForm({ ...form, memberNumber: value })
                  }
                />

                <FormInput
                  label="Email"
                  value={form.email}
                  onChange={(value) => setForm({ ...form, email: value })}
                />

                <FormInput
                  label="Phone"
                  value={form.phone}
                  onChange={(value) => setForm({ ...form, phone: value })}
                />

                <FormInput
                  label="Service Address"
                  value={form.address}
                  required
                  onChange={(value) => setForm({ ...form, address: value })}
                />

                <FormInput
                  label="City"
                  value={form.city}
                  onChange={(value) => setForm({ ...form, city: value })}
                />

                <FormInput
                  label="State"
                  value={form.state}
                  onChange={(value) => setForm({ ...form, state: value })}
                />

                <FormInput
                  label="Postal Code"
                  value={form.postalCode}
                  onChange={(value) =>
                    setForm({ ...form, postalCode: value })
                  }
                />

                <label style={labelStyle}>
                  Job Type
                  <select
                    value={form.jobType}
                    onChange={(event) =>
                      setForm({ ...form, jobType: event.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="new_service">New Service</option>
                    <option value="service_upgrade">Service Upgrade</option>
                    <option value="line_extension">Line Extension</option>
                    <option value="no_omec_work_required">
                      No OMEC Work Required
                    </option>
                    <option value="cancelled_inactive">
                      Cancelled / Inactive
                    </option>
                  </select>
                </label>

                <div style={buttonRowStyle}>
                  <button
                    type="submit"
                    disabled={creating}
                    style={buttonStyle}
                  >
                    {creating ? "Creating..." : "Create Job"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    style={secondaryButtonStyle}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {!canEdit && (
        <section style={sectionStyle}>
          <p style={emptyStateStyle}>
            Viewer mode: you can search and view jobs, notes, and documents, but
            cannot create or update records.
          </p>
        </section>
      )}

      <section style={sectionStyle}>
        <h2>Search / Filter Jobs</h2>

        <FormInput
          label="Search"
          value={searchText}
          onChange={setSearchText}
        />

        <label style={labelStyle}>
          Gate Status
          <select
            value={gateFilter}
            onChange={(event) => setGateFilter(event.target.value)}
            style={inputStyle}
          >
            <option value="all">All</option>
            <option value="stop">STOP</option>
            <option value="go">GO</option>
            <option value="closed">Closed</option>
            <option value="watch">Watch</option>
          </select>
        </label>
      </section>

      <section style={sectionStyle}>
        <h2>Job List</h2>

        {loading ? (
          <p>Loading jobs...</p>
        ) : (
          <>
            <p>
              Showing {filteredJobs.length} of {jobs.length} jobs. Click a row
              to view details.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <TableHeader>Job #</TableHeader>
                    <TableHeader>Applicant</TableHeader>
                    <TableHeader>Member #</TableHeader>
                    <TableHeader>Stage</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Gate Message</TableHeader>
                    <TableHeader>Next Action</TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs.map((job) => (
                    <tr
                      key={job.job_number}
                      onClick={() => setSelectedJobNumber(job.job_number)}
                      style={{
                        cursor: "pointer",
                        background:
                          job.job_number === selectedJobNumber
                            ? "#fff7cc"
                            : "#ffffff",
                      }}
                    >
                      <TableCell>{job.job_number}</TableCell>
                      <TableCell>{job.applicant_name}</TableCell>
                      <TableCell>{job.member_number || "-"}</TableCell>
                      <TableCell>{job.current_stage}</TableCell>
                      <TableCell>{job.gate_status}</TableCell>
                      <TableCell>{job.gate_message}</TableCell>
                      <TableCell>{job.next_action}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {!selectedJobNumber && (
        <section style={sectionStyle}>
          <p style={emptyStateStyle}>
            Select a job from the list to view details, workflow actions,
            correction tools, notes, documents/photos, and activity history.
          </p>
        </section>
      )}

      {selectedJobNumber && selectedJobDetail && (
        <>
          <section style={sectionStyle}>
            <h2>Selected Job Details</h2>
            <button type="button" onClick={printJobPacket} style={buttonStyle}>
  Print / Save Job Packet
</button>
            <div style={detailCardStyle}>
              <h3>
                {selectedJobDetail.job_number} —{" "}
                {selectedJobDetail.applicant_name}
              </h3>

              <div style={detailGridStyle}>
                <Detail
                  label="Applicant Name"
                  value={selectedJobDetail.applicant_name}
                />
                <Detail
                  label="Member #"
                  value={selectedJobDetail.member_number}
                />
                <Detail label="Email" value={selectedJobDetail.email} />
                <Detail label="Phone" value={selectedJobDetail.phone} />
                <Detail label="Job Type" value={selectedJobDetail.job_type} />
                <Detail
                  label="Work Order #"
                  value={selectedJobDetail.work_order_number}
                />
                <Detail
                  label="Inquiry Date"
                  value={formatDate(selectedJobDetail.inquiry_date)}
                />
                <Detail
                  label="Address"
                  value={`${selectedJobDetail.service_address_line1}${
                    selectedJobDetail.service_address_line2
                      ? ", " + selectedJobDetail.service_address_line2
                      : ""
                  }`}
                />
                <Detail
                  label="City / State / ZIP"
                  value={`${selectedJobDetail.city || ""}, ${
                    selectedJobDetail.state || ""
                  } ${selectedJobDetail.postal_code || ""}`}
                />
                <Detail
                  label="Current Stage"
                  value={selectedJobDetail.current_stage}
                />
                <Detail label="Gate" value={selectedJobDetail.gate_message} />
                <Detail
                  label="Next Action"
                  value={selectedJobDetail.next_action}
                />
                <Detail
                  label="Membership"
                  value={selectedJobDetail.membership_status}
                />
                <Detail
                  label="Site Fee"
                  value={selectedJobDetail.site_fee_status}
                />
                <Detail
                  label="Site Visit"
                  value={formatDateTime(selectedJobDetail.site_visit_at)}
                />
                <Detail
                  label="Estimate"
                  value={selectedJobDetail.estimate_status}
                />
                <Detail
                  label="Deposit"
                  value={`Required: $${formatMoney(
                    selectedJobDetail.deposit_required
                  )}, Received: $${formatMoney(
                    selectedJobDetail.deposit_received
                  )}`}
                />
                <Detail
                  label="Construction"
                  value={selectedJobDetail.construction_status}
                />
                <Detail
                  label="Inspection Received"
                  value={selectedJobDetail.inspection_received ? "Yes" : "No"}
                />
                <Detail
                  label="Inspection Date"
                  value={formatDateTime(
                    selectedJobDetail.inspection_received_at
                  )}
                />
                <Detail
                  label="Final Payment"
                  value={
                    selectedJobDetail.final_payment_received ? "Yes" : "No"
                  }
                />
                <Detail
                  label="Energized"
                  value={formatDateTime(selectedJobDetail.energized_at)}
                />
              </div>
            </div>
          </section>

          {canEdit && (
            <>
              <section style={sectionStyle}>
                <h2>Workflow Inputs</h2>

                <p>
                  Dates use MM-DD-YYYY. Deposit amounts can be entered as whole
                  numbers or decimals.
                </p>

                <div style={detailGridStyle}>
                  <FormInput
                    label="Site Visit Date"
                    value={siteVisitDate}
                    onChange={setSiteVisitDate}
                  />

                  <FormInput
                    label="Inspection Date"
                    value={inspectionDate}
                    onChange={setInspectionDate}
                  />

                  <FormInput
                    label="Energized Date"
                    value={energizedDate}
                    onChange={setEnergizedDate}
                  />

                  <FormInput
                    label="Deposit Required"
                    value={depositRequired}
                    onChange={setDepositRequired}
                  />

                  <FormInput
                    label="Deposit Received"
                    value={depositReceived}
                    onChange={setDepositReceived}
                  />
                </div>
              </section>

              <section style={sectionStyle}>
                <h2>Update Job Status</h2>

                <div style={buttonRowStyle}>
                  {nextActions.map((action) => (
                    <ActionButton
                      key={action.id}
                      disabled={updating || !selectedJobNumber}
                      onClick={() => handleWorkflowAction(action)}
                    >
                      {action.label}
                    </ActionButton>
                  ))}

                  {selectedJob && nextActions.length === 0 && (
                    <p>No workflow action needed for this job.</p>
                  )}
                </div>

                {updating && <p>Updating job...</p>}
              </section>
            </>
          )}

          {isAdmin && (
            <section style={sectionStyle}>
              <h2>Correction Tools</h2>

              <p>
                Use these only to correct mistakes. Resetting a job clears later
                workflow fields so the gate engine can recalculate the correct
                status.
              </p>

              <div style={buttonRowStyle}>
                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage("membership_needed", "Membership Needed")
                  }
                >
                  Reset to Membership Needed
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage("site_fee_needed", "Site Fee Needed")
                  }
                >
                  Reset to Site Fee Needed
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage("site_visit_needed", "Site Visit Needed")
                  }
                >
                  Reset to Site Visit Needed
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage("estimate_needed", "Estimate Needed")
                  }
                >
                  Reset to Estimate Needed
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage("awaiting_deposit", "Awaiting Deposit")
                  }
                >
                  Reset to Awaiting Deposit
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage(
                      "ready_for_construction",
                      "Ready for Construction"
                    )
                  }
                >
                  Reset to Ready for Construction
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage(
                      "waiting_on_inspection",
                      "Waiting on Inspection"
                    )
                  }
                >
                  Reset to Waiting on Inspection
                </ActionButton>

                <ActionButton
                  disabled={updating || !selectedJobNumber}
                  onClick={() =>
                    resetJobToStage("final_billing", "Final Billing")
                  }
                >
                  Reset to Final Billing
                </ActionButton>
              </div>
            </section>
          )}

          <section style={sectionStyle}>
            <h2>Internal Notes</h2>

            {canEdit && (
              <form onSubmit={addComment}>
                <label style={labelStyle}>
                  Add Note
                  <textarea
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    style={{ ...inputStyle, minHeight: "90px" }}
                    placeholder="Enter internal note..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={addingComment}
                  style={buttonStyle}
                >
                  {addingComment ? "Adding..." : "Add Note"}
                </button>
              </form>
            )}

            {!canEdit && (
              <p style={emptyStateStyle}>
                Viewer mode: notes are read-only.
              </p>
            )}

            <h3 style={{ marginTop: "24px" }}>
              Notes for {selectedJobNumber}
            </h3>

            {comments.length === 0 ? (
              <p>No notes for this job yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {comments.map((comment) => (
                  <div key={comment.id} style={noteCardStyle}>
                    <div>{comment.comment_body}</div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#555",
                        marginTop: "8px",
                      }}
                    >
                      {comment.visibility} —{" "}
                      {new Date(comment.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <h2>Activity History</h2>

            {activities.length === 0 ? (
              <p>No activity has been recorded for this job yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {activities.map((activity) => (
                  <div key={activity.id} style={activityCardStyle}>
                    <div style={{ fontWeight: 700 }}>
                      {activity.action_label}
                    </div>

                    <div style={{ fontSize: "13px", color: "#555" }}>
                      {activity.actor_email || "Unknown user"} —{" "}
                      {new Date(activity.created_at).toLocaleString()}
                    </div>

                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      Type: {formatActivityKey(activity.action_type)}
                    </div>

                    {activity.details &&
                      Object.keys(activity.details).length > 0 && (
                        <div style={activityDetailsStyle}>
                          {Object.entries(activity.details).map(
                            ([key, value]) => (
                              <div key={key} style={activityDetailRowStyle}>
                                <strong>{formatActivityKey(key)}:</strong>{" "}
                                <span>{formatActivityValue(value)}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section id="job-packet-print-area" style={printPacketStyle}>
  <h1>OMEC Job Packet</h1>

  <h2>
    {selectedJobDetail.job_number} — {selectedJobDetail.applicant_name}
  </h2>

  <h3>Job Summary</h3>
  <table>
    <tbody>
      <tr>
        <td>Applicant</td>
        <td>{selectedJobDetail.applicant_name}</td>
      </tr>
      <tr>
        <td>Member #</td>
        <td>{selectedJobDetail.member_number || "-"}</td>
      </tr>
      <tr>
        <td>Email</td>
        <td>{selectedJobDetail.email || "-"}</td>
      </tr>
      <tr>
        <td>Phone</td>
        <td>{selectedJobDetail.phone || "-"}</td>
      </tr>
      <tr>
        <td>Address</td>
        <td>
          {selectedJobDetail.service_address_line1}
          {selectedJobDetail.service_address_line2
            ? `, ${selectedJobDetail.service_address_line2}`
            : ""}
          , {selectedJobDetail.city || ""}, {selectedJobDetail.state || ""}{" "}
          {selectedJobDetail.postal_code || ""}
        </td>
      </tr>
      <tr>
        <td>Job Type</td>
        <td>{selectedJobDetail.job_type}</td>
      </tr>
      <tr>
        <td>Current Stage</td>
        <td>{selectedJobDetail.current_stage}</td>
      </tr>
      <tr>
        <td>Gate</td>
        <td>{selectedJobDetail.gate_message}</td>
      </tr>
      <tr>
        <td>Next Action</td>
        <td>{selectedJobDetail.next_action}</td>
      </tr>
    </tbody>
  </table>

  <h3>Workflow / Payment</h3>
  <table>
    <tbody>
      <tr>
        <td>Membership</td>
        <td>{selectedJobDetail.membership_status}</td>
      </tr>
      <tr>
        <td>Site Fee</td>
        <td>{selectedJobDetail.site_fee_status}</td>
      </tr>
      <tr>
        <td>Site Visit</td>
        <td>{formatDateTime(selectedJobDetail.site_visit_at)}</td>
      </tr>
      <tr>
        <td>Estimate</td>
        <td>{selectedJobDetail.estimate_status}</td>
      </tr>
      <tr>
        <td>Deposit Required</td>
        <td>${formatMoney(selectedJobDetail.deposit_required)}</td>
      </tr>
      <tr>
        <td>Deposit Received</td>
        <td>${formatMoney(selectedJobDetail.deposit_received)}</td>
      </tr>
      <tr>
        <td>Construction</td>
        <td>{selectedJobDetail.construction_status}</td>
      </tr>
      <tr>
        <td>Inspection Received</td>
        <td>{selectedJobDetail.inspection_received ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <td>Inspection Date</td>
        <td>{formatDateTime(selectedJobDetail.inspection_received_at)}</td>
      </tr>
      <tr>
        <td>Final Payment</td>
        <td>{selectedJobDetail.final_payment_received ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <td>Energized</td>
        <td>{formatDateTime(selectedJobDetail.energized_at)}</td>
      </tr>
    </tbody>
  </table>

  <h3>Internal Notes</h3>
  {comments.length === 0 ? (
    <p>No notes recorded.</p>
  ) : (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>
          {new Date(comment.created_at).toLocaleString()} —{" "}
          {comment.comment_body}
        </li>
      ))}
    </ul>
  )}

  <h3>Documents / Photos</h3>
  {documents.length === 0 ? (
    <p>No documents recorded.</p>
  ) : (
    <ul>
      {documents.map((document) => (
        <li key={document.id}>
          {document.document_type}: {document.file_name}
        </li>
      ))}
    </ul>
  )}

  <h3>Activity History</h3>
  {activities.length === 0 ? (
    <p>No activity recorded.</p>
  ) : (
    <ul>
      {activities.map((activity) => (
        <li key={activity.id}>
          {new Date(activity.created_at).toLocaleString()} —{" "}
          {activity.actor_email || "Unknown user"} — {activity.action_label}
        </li>
      ))}
    </ul>
  )}
</section>
          <section style={sectionStyle}>
            <h2>Documents / Photos</h2>

            {canEdit && (
              <form onSubmit={uploadDocument}>
                <label style={labelStyle}>
                  Document Type
                  <select
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="application">Application</option>
                    <option value="estimate">Estimate</option>
                    <option value="signed_estimate">Signed Estimate</option>
                    <option value="site_photo">Site Photo</option>
                    <option value="construction_photo">
                      Construction Photo
                    </option>
                    <option value="easement_row">Easement / ROW</option>
                    <option value="inspection">Inspection</option>
                    <option value="payment_record">Payment Record</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  File or Photo
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    capture="environment"
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] || null)
                    }
                    style={inputStyle}
                  />
                </label>

                <button
                  type="submit"
                  disabled={uploading || !selectedJobNumber}
                  style={buttonStyle}
                >
                  {uploading ? "Uploading..." : "Upload File / Photo"}
                </button>
              </form>
            )}

            {!canEdit && (
              <p style={emptyStateStyle}>
                Viewer mode: documents are read-only.
              </p>
            )}

            <h3 style={{ marginTop: "24px" }}>Files for {selectedJobNumber}</h3>

            {documents.length === 0 ? (
              <p>No files uploaded for this job yet.</p>
            ) : (
              <div style={fileGridStyle}>
                {documents.map((document) => {
                  const fileUrl = signedFileUrls[document.storage_path];
                  const isImage = isImageFile(document.file_name);

                  return (
                    <div key={document.id} style={fileCardStyle}>
                      {!fileUrl ? (
                        <div style={filePlaceholderStyle}>
                          Preparing secure link...
                        </div>
                      ) : isImage ? (
                        <a href={fileUrl} target="_blank" rel="noreferrer">
                          <img
                            src={fileUrl}
                            alt={document.file_name}
                            style={thumbnailStyle}
                          />
                        </a>
                      ) : (
                        <div style={filePlaceholderStyle}>File</div>
                      )}

                      {fileUrl ? (
                        <a href={fileUrl} target="_blank" rel="noreferrer">
                          {document.file_name}
                        </a>
                      ) : (
                        <span>{document.file_name}</span>
                      )}

                      <div style={{ fontSize: "12px", marginTop: "4px" }}>
                        {document.document_type}
                      </div>

                      <div style={{ fontSize: "12px", color: "#555555" }}>
                        {new Date(document.created_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function getNextActions(job: JobListItem | undefined): WorkflowAction[] {
  if (!job) return [];

  switch (job.current_stage) {
    case "membership_needed":
      return [{ id: "membership_complete", label: "Mark Membership Complete" }];

    case "site_fee_needed":
      return [{ id: "site_fee_paid", label: "Mark Site Fee Paid" }];

    case "site_visit_needed":
      return [{ id: "set_site_visit", label: "Set Site Visit Date" }];

    case "estimate_needed":
      return [{ id: "estimate_signed", label: "Mark Estimate Signed" }];

    case "awaiting_deposit":
      return [{ id: "deposit_received", label: "Update Deposit Received" }];

    case "ready_for_construction":
      return [
        {
          id: "construction_in_progress",
          label: "Mark Construction In Progress",
        },
      ];

    case "in_construction":
      return [
        {
          id: "construction_complete",
          label: "Mark Construction Complete",
        },
      ];

    case "waiting_on_inspection":
      return [
        {
          id: "inspection_received",
          label: "Mark Inspection Received",
        },
      ];

    case "final_billing":
      if (job.gate_message === "STOP - Final Payment not received") {
        return [
          {
            id: "final_payment_received",
            label: "Mark Final Payment Received",
          },
        ];
      }

      if (job.gate_message === "GO - Energize Service") {
        return [
          {
            id: "energized_closed",
            label: "Mark Energized / Closed",
          },
        ];
      }

      return [];

    default:
      return [];
  }
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[$,]/g, "").trim();

  if (cleaned === "") {
    return null;
  }

  const numberValue = Number(cleaned);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue * 100) / 100;
}

function formatMoney(value: number | null) {
  return Number(value ?? 0).toFixed(2);
}

function mmDdYyyyToIso(value: string, utcHour: number) {
  const trimmed = value.trim();
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const testDate = new Date(Date.UTC(year, month - 1, day));

  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const yyyy = String(year);
  const hour = String(utcHour).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hour}:00:00Z`;
}

function isImageFile(fileName: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}-${day}-${year}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}-${day}-${year}, ${date.toLocaleTimeString()}`;
}

function formatActivityKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatActivityValue(value: unknown) {
  if (value === null || value === undefined) return "-";

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return String(value);
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

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <div style={dashboardCardStyle}>
      <h2>{title}</h2>
      <p style={{ fontSize: "32px", margin: 0 }}>{value}</p>
    </div>
  );
}

function FormInput({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#cccccc" : "#111111",
        color: disabled ? "#666666" : "#ffffff",
        border: "1px solid #111111",
        borderRadius: "4px",
      }}
    >
      {children}
    </button>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        borderBottom: "2px solid #ccc",
        textAlign: "left",
        padding: "10px",
        background: "#f2f2f2",
        color: "#111111",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        borderBottom: "1px solid #eeeeee",
        padding: "10px",
        verticalAlign: "top",
        color: "#111111",
      }}
    >
      {children}
    </td>
  );
}

const mainStyle: React.CSSProperties = {
  padding: "40px",
  fontFamily: "Arial, sans-serif",
  background: "#ffffff",
  color: "#111111",
  minHeight: "100vh",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const messageStyle: React.CSSProperties = {
  padding: "12px",
  border: "1px solid #ccc",
  background: "#f7f7f7",
  color: "#111111",
};

const dashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginTop: "24px",
};

const dashboardCardStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "20px",
  background: "#ffffff",
  color: "#111111",
};

const sectionStyle: React.CSSProperties = {
  marginTop: "40px",
  maxWidth: "1000px",
  background: "#ffffff",
  color: "#111111",
};

const panelStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  border: "1px solid #ccc",
  background: "#fafafa",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "16px",
  border: "1px dashed #999",
  background: "#fafafa",
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
  border: "1px solid #999999",
  borderRadius: "4px",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "10px 16px",
  cursor: "pointer",
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  borderRadius: "4px",
};

const secondaryButtonStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "10px 16px",
  cursor: "pointer",
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #111111",
  borderRadius: "4px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "16px",
};

const detailCardStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  border: "1px solid #ccc",
  background: "#fafafa",
  color: "#111111",
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const noteCardStyle: React.CSSProperties = {
  padding: "12px",
  border: "1px solid #ccc",
  background: "#fafafa",
};

const activityCardStyle: React.CSSProperties = {
  padding: "12px",
  border: "1px solid #ccc",
  background: "#fafafa",
};

const activityDetailsStyle: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px",
  background: "#ffffff",
  border: "1px solid #ddd",
  fontSize: "13px",
  display: "grid",
  gap: "6px",
};

const activityDetailRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const fileGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: "16px",
  marginTop: "12px",
};

const fileCardStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "10px",
  background: "#fafafa",
  color: "#111111",
};

const thumbnailStyle: React.CSSProperties = {
  width: "100%",
  height: "140px",
  objectFit: "cover",
  border: "1px solid #ccc",
  marginBottom: "8px",
  background: "#ffffff",
};

const filePlaceholderStyle: React.CSSProperties = {
  height: "140px",
  border: "1px solid #ccc",
  marginBottom: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  textAlign: "center",
  padding: "8px",
  color: "#111111",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "12px",
  background: "#ffffff",
  color: "#111111",
};
const printPacketStyle: React.CSSProperties = {
  display: "none",
};