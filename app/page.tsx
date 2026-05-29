"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

type EditInfoForm = {
  applicantName: string;
  memberNumber: string;
  email: string;
  phone: string;
  serviceAddressLine1: string;
  serviceAddressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  workOrderNumber: string;
};

type WorkflowUpdates = {
  p_membership_status?: string | null;
  p_site_fee_status?: string | null;
  p_site_visit_at?: string | null;
  p_estimate_status?: string | null;
  p_estimate_amount?: number | null;
  p_deposit_required?: number | null;
  p_deposit_received?: number | null;
  p_construction_status?: string | null;
  p_inspection_received?: boolean | null;
  p_inspection_received_at?: string | null;
  p_final_bill_amount?: number | null;
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
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobDetail | null>(null);
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [signedFileUrls, setSignedFileUrls] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<JobComment[]>([]);
  const [activities, setActivities] = useState<JobActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [showEditInfoForm, setShowEditInfoForm] = useState(false);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [correctionToolsOpen, setCorrectionToolsOpen] = useState(false);
  const [savingEditInfo, setSavingEditInfo] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedJobNumber, setSelectedJobNumber] = useState("");
  const [message, setMessage] = useState("");
  const [memberAccessLink, setMemberAccessLink] = useState("");
  const [documentType, setDocumentType] = useState("site_photo");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const [searchText, setSearchText] = useState("");
  const [gateFilter, setGateFilter] = useState("all");
  const [jobListCollapsed, setJobListCollapsed] = useState(false);
  const [flashJobNumber, setFlashJobNumber] = useState("");

  const [siteVisitDate, setSiteVisitDate] = useState("05-20-2026");
  const [inspectionDate, setInspectionDate] = useState("05-21-2026");
  const [energizedDate, setEnergizedDate] = useState("05-22-2026");

  const [estimateAmount, setEstimateAmount] = useState("0");
  const [depositRequired, setDepositRequired] = useState("0");
  const [depositReceived, setDepositReceived] = useState("0");
  const [finalPaymentRefund, setFinalPaymentRefund] = useState("0");
  const [constructionStatus, setConstructionStatus] = useState("pending");
const [constructionStatusNote, setConstructionStatusNote] = useState("");

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

  const [editInfoForm, setEditInfoForm] = useState<EditInfoForm>({
    applicantName: "",
    memberNumber: "",
    email: "",
    phone: "",
    serviceAddressLine1: "",
    serviceAddressLine2: "",
    city: "",
    state: "OK",
    postalCode: "",
    workOrderNumber: "",
  });

  const selectedJob = jobs.find((job) => job.job_number === selectedJobNumber);
  const nextActions = getNextActions(selectedJobDetail || selectedJob);

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

      const matchesGate = gateFilter === "all" || job.gate_status === gateFilter;

      return matchesSearch && matchesGate;
    });
  }, [jobs, searchText, gateFilter]);

  const visibleJobs =
    jobListCollapsed && selectedJobNumber
      ? filteredJobs.filter((job) => job.job_number === selectedJobNumber)
      : filteredJobs;

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserRole();
      } else {
        setUserRole("viewer");
      }
    });

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
      setShowEditInfoForm(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSelectedJobData(selectedJobNumber);
    }
  }, [selectedJobNumber, user]);

  function selectJobFromList(jobNumber: string) {
    setFlashJobNumber(jobNumber);
    setSelectedJobNumber(jobNumber);

    window.setTimeout(() => {
      setJobListCollapsed(true);
      setFlashJobNumber("");
    }, 220);
  }

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
      setMessage(summaryError?.message || jobsError?.message || "Error loading data");
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
      setMemberAccessLink("");
      setShowEditInfoForm(false);
      setActivityHistoryOpen(false);
      setNotesOpen(false);
      setDocumentsOpen(false);
      setCorrectionToolsOpen(false);
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
      setActivityHistoryOpen(false);
      setNotesOpen(false);
      setDocumentsOpen(false);
      setCorrectionToolsOpen(false);

      await loadSignedFileUrls(loadedDocuments);

      setEstimateAmount(
        detailData.estimate_amount === null ? "" : String(detailData.estimate_amount)
      );
      setDepositRequired(String(detailData.deposit_required ?? 0));
      setDepositReceived(String(detailData.deposit_received ?? 0));
      setFinalPaymentRefund(String(detailData.final_bill_amount ?? 0));
      setConstructionStatus(detailData.construction_status || "pending");
setConstructionStatusNote("");

      setEditInfoForm({
        applicantName: detailData.applicant_name || "",
        memberNumber: detailData.member_number || "",
        email: detailData.email || "",
        phone: detailData.phone || "",
        serviceAddressLine1: detailData.service_address_line1 || "",
        serviceAddressLine2: detailData.service_address_line2 || "",
        city: detailData.city || "",
        state: detailData.state || "OK",
        postalCode: detailData.postal_code || "",
        workOrderNumber: detailData.work_order_number || "",
      });
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

    const { data, error } = await supabase.rpc("create_job_with_member_auto_number", {
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
    });

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

  async function saveJobInfo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setMessage("You do not have permission to edit job information.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    if (!editInfoForm.applicantName.trim()) {
      setMessage("Applicant name is required.");
      return;
    }

    if (!editInfoForm.serviceAddressLine1.trim()) {
      setMessage("Service address is required.");
      return;
    }

    setSavingEditInfo(true);
    setMessage("");

    const { error } = await supabase.rpc("update_job_member_info", {
      p_job_number: selectedJobNumber,
      p_applicant_name: editInfoForm.applicantName.trim(),
      p_member_number: editInfoForm.memberNumber.trim(),
      p_email: editInfoForm.email.trim(),
      p_phone: editInfoForm.phone.trim(),
      p_service_address_line1: editInfoForm.serviceAddressLine1.trim(),
      p_service_address_line2: editInfoForm.serviceAddressLine2.trim(),
      p_city: editInfoForm.city.trim(),
      p_state: editInfoForm.state.trim(),
      p_postal_code: editInfoForm.postalCode.trim(),
      p_work_order_number: editInfoForm.workOrderNumber.trim(),
    });

    if (error) {
      setMessage(`Error saving job info: ${error.message}`);
    } else {
      setMessage(`Updated job info for ${selectedJobNumber}`);
      setShowEditInfoForm(false);
      await loadDashboard();
      await loadSelectedJobData(selectedJobNumber);
    }

    setSavingEditInfo(false);
  }
  async function saveEstimateDepositAmounts() {
    if (!canEdit) {
      setMessage("You do not have permission to update estimate/deposit amounts.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    const parsedEstimate =
      estimateAmount.trim() === "" ? null : parseMoney(estimateAmount);
    const parsedDepositRequired =
      depositRequired.trim() === "" ? 0 : parseMoney(depositRequired);
    const parsedDepositReceived =
      depositReceived.trim() === "" ? 0 : parseMoney(depositReceived);
    const parsedFinalPaymentRefund =
      finalPaymentRefund.trim() === "" ? null : parseSignedMoney(finalPaymentRefund);

    if (
      parsedEstimate === null && estimateAmount.trim() !== "" ||
      parsedDepositRequired === null ||
      parsedDepositReceived === null ||
      parsedFinalPaymentRefund === null && finalPaymentRefund.trim() !== ""
    ) {
      window.alert("Enter valid dollar amounts before saving.");
      setMessage("Cannot save: valid estimate/deposit/final payment amounts are required.");
      return;
    }

    if (
      parsedEstimate !== null &&
      parsedEstimate > 0 &&
      Number(parsedDepositRequired ?? 0) === 0
    ) {
      const confirmed = window.confirm(
        "Estimate amount is greater than $0, but Deposit Required is $0. Confirm that no deposit is required for this job?"
      );

      if (!confirmed) {
        setMessage(
          "Save canceled. Enter a Deposit Required amount, or confirm that no deposit is required."
        );
        return;
      }
    }

    setUpdating(true);
    setMessage("");

    const { error } = await supabase.rpc("update_job_workflow_status", {
      p_job_number: selectedJobNumber,
      p_membership_status: null,
      p_site_fee_status: null,
      p_site_visit_at: null,
      p_estimate_status: null,
      p_estimate_amount: parsedEstimate,
      p_deposit_required: parsedDepositRequired,
      p_deposit_received: parsedDepositReceived,
      p_construction_status: null,
      p_inspection_received: null,
      p_inspection_received_at: null,
      p_final_bill_amount: parsedFinalPaymentRefund,
      p_final_payment_received: null,
      p_energized_at: null,
    });

    if (error) {
      setMessage(`Error saving estimate/deposit amounts: ${error.message}`);
    } else {
      setMessage(`Saved estimate/deposit/final payment amounts for ${selectedJobNumber}`);
      await loadDashboard();
      await loadSelectedJobData(selectedJobNumber);
    }

    setUpdating(false);
  }

  async function generateMemberAccessLink() {
    if (!canEdit) {
      setMessage("You do not have permission to generate member access links.");
      return;
    }

    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }

    setUpdating(true);
    setMessage("");
    setMemberAccessLink("");

    const { data, error } = await supabase.rpc(
      "create_member_access_token_by_job",
      {
        p_job_number: selectedJobNumber,
        p_expires_in_hours: 168,
      }
    );

    if (error) {
      setMessage(`Error generating member access link: ${error.message}`);
    } else {
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://omecconnect.com";

      const accessLink = `${baseUrl}/member-access/${data}`;

      setMemberAccessLink(accessLink);
      setMessage("Member access link generated successfully.");

      window.alert(`Member link generated:

${accessLink}`);
    }

    setUpdating(false);
  }

  async function saveConstructionStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  
    if (!canEdit) {
      setMessage("You do not have permission to update construction status.");
      return;
    }
  
    if (!selectedJobNumber) {
      setMessage("Select a job first.");
      return;
    }
  
    if (constructionStatus === "waiting_on_member" && !constructionStatusNote.trim()) {
      window.alert(
        "Cannot save Waiting on Member: add a note explaining what is needed from the member."
      );
      setMessage("Waiting on Member requires an explanatory note.");
      return;
    }
  
    setUpdating(true);
    setMessage("");
  
    const { error } = await supabase.rpc("update_job_construction_status", {
      p_job_number: selectedJobNumber,
      p_construction_status: constructionStatus,
      p_note: constructionStatusNote.trim(),
    });
  
    if (error) {
      setMessage(`Error updating construction status: ${error.message}`);
    } else {
      setMessage(`Updated construction status for ${selectedJobNumber}`);
      setConstructionStatusNote("");
      await loadDashboard();
      await loadSelectedJobData(selectedJobNumber);
    }
  
    setUpdating(false);
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
      p_estimate_amount: updates.p_estimate_amount ?? null,
      p_deposit_required: updates.p_deposit_required ?? null,
      p_deposit_received: updates.p_deposit_received ?? null,
      p_construction_status: updates.p_construction_status ?? null,
      p_inspection_received: updates.p_inspection_received ?? null,
      p_inspection_received_at: updates.p_inspection_received_at ?? null,
      p_final_bill_amount: updates.p_final_bill_amount ?? null,
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
        window.alert(
        "Cannot schedule site visit: enter Site Visit Date in MM-DD-YYYY format."
      );
      setMessage("Cannot schedule site visit: valid Site Visit Date required.");
        return null;
      }

      return { p_site_visit_at: isoDate };
    }

    if (actionId === "estimate_sent") {
      const amount = estimateAmount.trim() === "" ? 0 : parseMoney(estimateAmount);
      const required = depositRequired.trim() === "" ? 0 : parseMoney(depositRequired);
      const received = depositReceived.trim() === "" ? 0 : parseMoney(depositReceived);

      if (amount === null || amount < 0) {
        window.alert("Cannot mark estimate sent: enter a valid Estimate Amount.");
        setMessage("Cannot mark estimate sent: valid Estimate Amount required.");
        return null;
      }

      if (required === null || required < 0 || received === null || received < 0) {
        window.alert("Cannot mark estimate sent: enter valid deposit amounts.");
        setMessage("Cannot mark estimate sent: valid deposit amounts required.");
        return null;
      }

      if (amount === 0 || required === 0) {
        const confirmed = window.confirm(
          "Estimate Amount or Deposit Required is $0. Confirm this job does not require a signed estimate/deposit step and should move toward construction?"
        );

        if (!confirmed) {
          setMessage(
            "Estimate sent was canceled. Enter Estimate Amount and Deposit Required if approval/deposit is required."
          );
          return null;
        }

        return {
          p_estimate_status: "signed",
          p_estimate_amount: amount,
          p_deposit_required: 0,
          p_deposit_received: 0,
          p_construction_status: "pending",
        };
      }

      return {
        p_estimate_status: "sent",
        p_estimate_amount: amount,
        p_deposit_required: required,
        p_deposit_received: received,
      };
    }

    if (actionId === "estimate_signed") {
      const required = parseMoney(depositRequired);
      const received = parseMoney(depositReceived);

      if (required === null || received === null) {
        window.alert(
          "Cannot mark estimate signed: enter valid Deposit Required and Deposit Received amounts."
        );
        setMessage("Cannot mark estimate signed: valid deposit amounts required.");
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
        window.alert(
        "Cannot update deposit: enter a valid Deposit Received amount."
      );
      setMessage("Cannot update deposit: valid Deposit Received amount required.");
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
        window.alert(
        "Cannot mark inspection received: enter Inspection Date in MM-DD-YYYY format."
      );
      setMessage("Cannot mark inspection received: valid Inspection Date required.");
        return null;
      }

      return {
        p_inspection_received: true,
        p_inspection_received_at: isoDate,
      };
    }

    if (actionId === "final_payment_received") {
      const finalAmount =
        finalPaymentRefund.trim() === "" ? 0 : parseSignedMoney(finalPaymentRefund);

      if (finalAmount === null) {
        window.alert("Cannot mark final payment/refund complete: enter a valid Final Payment / Refund amount.");
        setMessage("Cannot mark final payment/refund complete: valid amount required.");
        return null;
      }

      return {
        p_final_bill_amount: finalAmount,
        p_final_payment_received: true,
      };
    }

    if (actionId === "energized_closed") {
      const isoDate = mmDdYyyyToIso(energizedDate, 14);

      if (!isoDate) {
        window.alert(
        "Cannot close job: enter Energized Date in MM-DD-YYYY format."
      );
      setMessage("Cannot close job: valid Energized Date required.");
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

    const { error: recordError } = await supabase.rpc("add_job_document_by_number", {
      p_job_number: selectedJobNumber,
      p_document_type: documentType,
      p_file_name: selectedFile.name,
      p_storage_path: storagePath,
    });

    if (recordError) {
      setMessage(`File uploaded, but document record failed: ${recordError.message}`);
    } else {
      setMessage(`Uploaded ${selectedFile.name} to ${selectedJobNumber}`);
      setSelectedFile(null);
      await loadSelectedJobData(selectedJobNumber);
    }

    setUploading(false);
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

  function printJobPacket() {
    window.print();
  }

  if (authLoading) {
    return (
      <main style={staffPageShellStyle}>
        <StaffGlobalStyles />
        <div style={staffLoadingCardStyle}>
          <h1 style={staffLoadingTitleStyle}>OMEC Connect</h1>
          <p style={staffMutedStyle}>Checking login...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={staffAuthShellStyle}>
        <StaffGlobalStyles />
        <section style={staffAuthCardStyle}>
          <div style={staffAuthBrandStyle}>
            <Image src="/omec-logo.png" alt="OMEC logo" width={96} height={96} style={staffAuthLogoStyle} />
            <div>
              <h1 style={staffPageTitleStyle}>OMEC Connect</h1>
              <p style={staffMutedStyle}>Operations Dashboard</p>
            </div>
          </div>

          {message && <p style={staffMessageStyle}>{message}</p>}

          <form onSubmit={signIn} style={staffAuthFormStyle}>
            <h2 style={staffSectionTitleStyle}>Login</h2>

            <FormInput label="Email" value={loginEmail} required onChange={setLoginEmail} />

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

            <button type="submit" disabled={loginBusy} style={staffPrimaryButtonStyle}>
              {loginBusy ? "Logging in..." : "Log In"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const selectedStageLabel = selectedJobDetail
    ? formatDisplayLabel(selectedJobDetail.current_stage)
    : selectedJob
      ? formatDisplayLabel(selectedJob.current_stage)
      : "No Job Selected";

  return (
    <main style={staffPageShellStyle}>
      <StaffGlobalStyles />
      <header style={staffTopBarStyle}>
        <div style={staffBrandHeaderStyle}>
          <Image src="/omec-logo.png" alt="OMEC logo" width={78} height={78} style={staffLogoStyle} />
          <div>
            <h1 style={staffPageTitleStyle}>OMEC Connect</h1>
            <p style={staffPageSubtitleStyle}>Operations Dashboard</p>
            <p style={staffUserLineStyle}>
              Logged in as <strong>{user.email}</strong> — Role: <strong>{userRole}</strong>
            </p>
          </div>
        </div>

        <div style={staffTopActionsStyle}>
          {canEdit && (
            <button type="button" onClick={() => setShowCreateForm(!showCreateForm)} style={staffSecondaryButtonStyle}>
              {showCreateForm ? "Hide Create Job" : "Create New Job"}
            </button>
          )}
          <button type="button" onClick={signOut} style={staffSecondaryButtonStyle}>
            Log Out
          </button>
        </div>
      </header>

      {message && <p style={staffMessageStyle}>{message}</p>}

      <section style={staffSummaryGridStyle}>
        <DashboardCard title="Total Jobs" value={summary?.total_jobs ?? 0} />
        <DashboardCard title="Open STOP Items" value={summary?.open_stop_items ?? 0} />
        <DashboardCard title="Closed Jobs" value={summary?.closed_jobs ?? 0} />
      </section>

      {canEdit && showCreateForm && (
        <section style={staffFullWidthCardStyle}>
          <h2 style={staffSectionTitleStyle}>Create New Job</h2>

          <form onSubmit={createJob}>
            <div style={staffFormGridStyle}>
              <FormInput label="Applicant Name" value={form.applicantName} required onChange={(value) => setForm({ ...form, applicantName: value })} />
              <FormInput label="Member Number" value={form.memberNumber} onChange={(value) => setForm({ ...form, memberNumber: value })} />
              <FormInput label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <FormInput label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <FormInput label="Service Address" value={form.address} required onChange={(value) => setForm({ ...form, address: value })} />
              <FormInput label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
              <FormInput label="State" value={form.state} onChange={(value) => setForm({ ...form, state: value })} />
              <FormInput label="Postal Code" value={form.postalCode} onChange={(value) => setForm({ ...form, postalCode: value })} />

              <label style={labelStyle}>
                Job Type
                <select
                  value={form.jobType}
                  onChange={(event) => setForm({ ...form, jobType: event.target.value })}
                  style={inputStyle}
                >
                  <option value="new_service">New Service</option>
                  <option value="service_upgrade">Service Upgrade</option>
                  <option value="line_extension">Line Extension</option>
                  <option value="no_omec_work_required">No OMEC Work Required</option>
                  <option value="cancelled_inactive">Cancelled / Inactive</option>
                </select>
              </label>
            </div>

            <div style={staffButtonRowStyle}>
              <button type="submit" disabled={creating} style={staffPrimaryButtonStyle}>
                {creating ? "Creating..." : "Create Job"}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} style={staffSecondaryButtonStyle}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {!canEdit && (
        <section style={staffFullWidthCardStyle}>
          <p style={emptyStateStyle}>
            Viewer mode: you can search and view jobs, notes, and documents, but cannot create or update records.
          </p>
        </section>
      )}

      <section style={staffDesktopGridStyle}>
        <aside style={staffJobQueueCardStyle}>
          <div style={staffPanelHeaderStyle}>
            <div>
              <h2 style={staffSectionTitleStyle}>Jobs</h2>
              <p style={staffMutedStyle}>
                Showing {visibleJobs.length} of {jobs.length}
              </p>
            </div>

            {jobListCollapsed && selectedJobNumber && (
              <button type="button" onClick={() => setJobListCollapsed(false)} style={staffSmallButtonStyle}>
                Show All
              </button>
            )}
          </div>

          <FormInput label="Search" value={searchText} onChange={setSearchText} />

          <label style={labelStyle}>
            Gate Status
            <select value={gateFilter} onChange={(event) => setGateFilter(event.target.value)} style={inputStyle}>
              <option value="all">All</option>
              <option value="stop">STOP</option>
              <option value="go">GO</option>
              <option value="closed">Closed</option>
              <option value="watch">Watch</option>
            </select>
          </label>

          <div style={staffJobListStyle}>
            {loading ? (
              <p style={staffMutedStyle}>Loading jobs...</p>
            ) : visibleJobs.length === 0 ? (
              <p style={emptyStateStyle}>No jobs match your filters.</p>
            ) : (
              visibleJobs.map((job) => (
                <button
                  type="button"
                  className="staff-job-row-button"
                  key={job.job_number}
                  onClick={() => selectJobFromList(job.job_number)}
                  style={{
                    ...staffJobRowStyle,
                    ...(flashJobNumber === job.job_number
                      ? staffJobRowFlashStyle
                      : job.job_number === selectedJobNumber
                        ? staffJobRowSelectedStyle
                        : {}),
                  }}
                >
                  <span style={staffJobRowTopStyle}>
                    <strong>{job.job_number}</strong>
                    {renderGateBadge(job.gate_status)}
                  </span>
                  <span style={staffJobApplicantStyle}>{job.applicant_name}</span>
                  <span style={staffJobMetaStyle}>
                    {job.member_number || "No member #"} · {formatDisplayLabel(job.current_stage)}
                  </span>
                  <span style={staffJobNextActionStyle}>{job.next_action}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section style={staffCenterColumnStyle}>
          {!selectedJobNumber && (
            <div style={staffFullWidthCardStyle}>
              <h2 style={staffSectionTitleStyle}>Select a job</h2>
              <p style={staffMutedStyle}>
                Choose a job from the left queue to view details, workflow actions, notes, documents, and history.
              </p>
            </div>
          )}

          {selectedJobNumber && selectedJobDetail && (
            <>
              <section style={staffSelectedJobHeaderStyle}>
                <div>
                  <p style={staffEyebrowStyle}>Selected Job</p>
                  <h2 style={staffSelectedJobTitleStyle}>
                    {selectedJobDetail.job_number} — {selectedJobDetail.applicant_name}
                  </h2>
                  <p style={staffMutedStyle}>
                    {selectedJobDetail.service_address_line1}
                    {selectedJobDetail.city ? `, ${selectedJobDetail.city}` : ""}
                    {selectedJobDetail.state ? `, ${selectedJobDetail.state}` : ""}
                  </p>
                </div>
                <span style={staffStageBadgeStyle}>{selectedStageLabel}</span>
              </section>

              {canEdit && showEditInfoForm && (
                <form onSubmit={saveJobInfo} style={staffFullWidthCardStyle}>
                  <h3 style={staffSectionTitleStyle}>Edit Job / Member Info</h3>

                  <div style={staffFormGridStyle}>
                    <FormInput label="Applicant Name" value={editInfoForm.applicantName} required onChange={(value) => setEditInfoForm({ ...editInfoForm, applicantName: value })} />
                    <FormInput label="Member Number" value={editInfoForm.memberNumber} onChange={(value) => setEditInfoForm({ ...editInfoForm, memberNumber: value })} />
                    <FormInput label="Email" value={editInfoForm.email} onChange={(value) => setEditInfoForm({ ...editInfoForm, email: value })} />
                    <FormInput label="Phone" value={editInfoForm.phone} onChange={(value) => setEditInfoForm({ ...editInfoForm, phone: value })} />
                    <FormInput label="Service Address" value={editInfoForm.serviceAddressLine1} required onChange={(value) => setEditInfoForm({ ...editInfoForm, serviceAddressLine1: value })} />
                    <FormInput label="Address Line 2" value={editInfoForm.serviceAddressLine2} onChange={(value) => setEditInfoForm({ ...editInfoForm, serviceAddressLine2: value })} />
                    <FormInput label="City" value={editInfoForm.city} onChange={(value) => setEditInfoForm({ ...editInfoForm, city: value })} />
                    <FormInput label="State" value={editInfoForm.state} onChange={(value) => setEditInfoForm({ ...editInfoForm, state: value })} />
                    <FormInput label="ZIP" value={editInfoForm.postalCode} onChange={(value) => setEditInfoForm({ ...editInfoForm, postalCode: value })} />
                    <FormInput label="Work Order Number" value={editInfoForm.workOrderNumber} onChange={(value) => setEditInfoForm({ ...editInfoForm, workOrderNumber: value })} />
                  </div>

                  <div style={staffButtonRowStyle}>
                    <button type="submit" disabled={savingEditInfo} style={staffPrimaryButtonStyle}>
                      {savingEditInfo ? "Saving..." : "Save Job Info"}
                    </button>
                    <button type="button" onClick={() => setShowEditInfoForm(false)} style={staffSecondaryButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {canEdit && (
                <>
                  <section style={staffWorkflowCardStyle}>
                    <div style={staffPanelHeaderStyle}>
                      <div>
                        <h2 style={staffSectionTitleStyle}>Workflow Inputs</h2>
                        <p style={staffMutedStyle}>Dates use MM-DD-YYYY. Money amounts can be positive or negative for final refunds.</p>
                      </div>
                    </div>

                    <div style={staffFormGridStyle}>
                      <FormInput label="Site Visit Date" value={siteVisitDate} onChange={setSiteVisitDate} />
                      <FormInput label="Inspection Date" value={inspectionDate} onChange={setInspectionDate} />
                      <FormInput label="Energized Date" value={energizedDate} onChange={setEnergizedDate} />
                      <FormInput label="Estimate Amount" value={estimateAmount} onChange={setEstimateAmount} />
                      <FormInput label="Deposit Required" value={depositRequired} onChange={setDepositRequired} />
                      <FormInput label="Deposit Received" value={depositReceived} onChange={setDepositReceived} />
                      <FormInput label="Final Payment / Refund" value={finalPaymentRefund} onChange={setFinalPaymentRefund} />
                    </div>

                    <button
                      type="button"
                      onClick={saveEstimateDepositAmounts}
                      disabled={updating || !selectedJobNumber}
                      style={staffPrimaryButtonStyle}
                    >
                      Save Estimate / Deposit / Final Amounts
                    </button>
                  </section>

                  {canShowConstructionControls(selectedJobDetail) && (
                    <section style={staffFullWidthCardStyle}>
                      <h2 style={staffSectionTitleStyle}>Construction Status</h2>
                      <p style={staffMutedStyle}>
                        Use this when a job is ready for construction, in progress, waiting on materials, waiting on the member, or complete.
                      </p>

                      <form onSubmit={saveConstructionStatus} style={staffStackStyle}>
                        <label style={labelStyle}>
                          Construction Status
                          <select
                            value={constructionStatus}
                            onChange={(event) => setConstructionStatus(event.target.value)}
                            style={inputStyle}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="waiting_on_material">Waiting on Materials</option>
                            <option value="waiting_on_member">Waiting on Member</option>
                            <option value="completed">Completed</option>
                            <option value="not_required">Not Required</option>
                          </select>
                        </label>

                        <label style={labelStyle}>
                          Construction Status Note
                          <textarea
                            value={constructionStatusNote}
                            onChange={(event) => setConstructionStatusNote(event.target.value)}
                            style={{ ...inputStyle, minHeight: "90px" }}
                            placeholder="Required if Waiting on Member. Example: Need easement signed, trench dug, meter base corrected..."
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={updating || !selectedJobNumber}
                          style={staffPrimaryButtonStyle}
                        >
                          Save Construction Status
                        </button>
                      </form>
                    </section>
                  )}

                  <section style={staffNextActionCardStyle}>
                    <div>
                      <h2 style={staffSectionTitleStyle}>Next Best Action</h2>
                      <p style={staffMutedStyle}>{selectedJobDetail.next_action}</p>
                    </div>

                    <div style={staffButtonRowStyle}>
                      {nextActions.map((action) => (
                        <ActionButton key={action.id} disabled={updating || !selectedJobNumber} onClick={() => handleWorkflowAction(action)}>
                          {action.label}
                        </ActionButton>
                      ))}

                      {selectedJob && nextActions.length === 0 && <p style={staffMutedStyle}>No workflow action needed for this job.</p>}
                    </div>

                    {updating && <p style={staffMutedStyle}>Updating job...</p>}
                  </section>
                </>
              )}

              <section style={staffDropdownSectionStyle}>
                <button
                  type="button"
                  className="staff-dropdown-header-button"
                  onClick={() => setNotesOpen(!notesOpen)}
                  style={staffDropdownHeaderButtonStyle}
                  aria-expanded={notesOpen}
                >
                  <span>
                    <span style={staffDropdownTitleStyle}>Internal Notes</span>
                    <span style={staffDropdownSubtitleStyle}>
                      {comments.length === 0
                        ? "No notes yet"
                        : `${comments.length} note${comments.length === 1 ? "" : "s"} recorded`}
                    </span>
                  </span>
                  <span style={staffDropdownChevronStyle}>{notesOpen ? "⌃" : "⌄"}</span>
                </button>

                {notesOpen && (
                  <div style={staffDropdownPanelStyle}>
                    {canEdit && (
                      <form onSubmit={addComment} style={staffStackStyle}>
                        <label style={labelStyle}>
                          Add Note
                          <textarea
                            value={commentBody}
                            onChange={(event) => setCommentBody(event.target.value)}
                            style={{ ...inputStyle, minHeight: "90px" }}
                            placeholder="Enter internal note..."
                          />
                        </label>

                        <button type="submit" disabled={addingComment} style={staffPrimaryButtonStyle}>
                          {addingComment ? "Adding..." : "Add Note"}
                        </button>
                      </form>
                    )}

                    {!canEdit && <p style={emptyStateStyle}>Viewer mode: notes are read-only.</p>}

                    {comments.length === 0 ? (
                      <p style={staffMutedStyle}>No notes for this job yet.</p>
                    ) : (
                      <div style={staffStackStyle}>
                        {comments.map((comment) => (
                          <div key={comment.id} style={noteCardStyle}>
                            <div>{comment.comment_body}</div>
                            <div style={{ fontSize: "12px", color: "#555", marginTop: "8px" }}>
                              {comment.visibility} — {new Date(comment.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section style={staffDropdownSectionStyle}>
                <button
                  type="button"
                  className="staff-dropdown-header-button"
                  onClick={() => setActivityHistoryOpen(!activityHistoryOpen)}
                  style={staffDropdownHeaderButtonStyle}
                  aria-expanded={activityHistoryOpen}
                >
                  <span>
                    <span style={staffDropdownTitleStyle}>Activity History</span>
                    <span style={staffDropdownSubtitleStyle}>
                      {activities.length === 0
                        ? "No activity recorded yet"
                        : `${activities.length} event${activities.length === 1 ? "" : "s"} recorded`}
                    </span>
                  </span>
                  <span style={staffDropdownChevronStyle}>{activityHistoryOpen ? "⌃" : "⌄"}</span>
                </button>

                {activityHistoryOpen && (
                  <div style={staffDropdownPanelStyle}>
                    {activities.length === 0 ? (
                      <p style={staffMutedStyle}>No activity has been recorded for this job yet.</p>
                    ) : (
                      <div style={staffStackStyle}>
                        {activities.map((activity) => (
                          <div key={activity.id} style={activityCardStyle}>
                            <div style={{ fontWeight: 700 }}>{activity.action_label}</div>
                            <div style={{ fontSize: "13px", color: "#555" }}>
                              {activity.actor_email || "Unknown user"} — {new Date(activity.created_at).toLocaleString()}
                            </div>
                            <div style={{ fontSize: "12px", marginTop: "4px" }}>Type: {formatDisplayLabel(activity.action_type)}</div>
                            {activity.details && Object.keys(activity.details).length > 0 && (
                              <div style={activityDetailsStyle}>
                                {Object.entries(activity.details).map(([key, value]) => (
                                  <div key={key} style={activityDetailRowStyle}>
                                    <strong>{formatDisplayLabel(key)}:</strong> <span>{formatActivityValue(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section style={staffDropdownSectionStyle}>
                <button
                  type="button"
                  className="staff-dropdown-header-button"
                  onClick={() => setDocumentsOpen(!documentsOpen)}
                  style={staffDropdownHeaderButtonStyle}
                  aria-expanded={documentsOpen}
                >
                  <span>
                    <span style={staffDropdownTitleStyle}>Documents / Photos</span>
                    <span style={staffDropdownSubtitleStyle}>
                      {documents.length === 0
                        ? "No files uploaded"
                        : `${documents.length} file${documents.length === 1 ? "" : "s"} uploaded`}
                    </span>
                  </span>
                  <span style={staffDropdownChevronStyle}>{documentsOpen ? "⌃" : "⌄"}</span>
                </button>

                {documentsOpen && (
                  <div style={staffDropdownPanelStyle}>
                    {canEdit && (
                      <form onSubmit={uploadDocument} style={staffStackStyle}>
                        <label style={labelStyle}>
                          Document Type
                          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} style={inputStyle}>
                            <option value="application">Application</option>
                            <option value="estimate">Estimate</option>
                            <option value="signed_estimate">Signed Estimate</option>
                            <option value="site_photo">Site Photo</option>
                            <option value="construction_photo">Construction Photo</option>
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
                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                            style={inputStyle}
                          />
                        </label>

                        <button type="submit" disabled={uploading || !selectedJobNumber} style={staffPrimaryButtonStyle}>
                          {uploading ? "Uploading..." : "Upload File / Photo"}
                        </button>
                      </form>
                    )}

                    {!canEdit && <p style={emptyStateStyle}>Viewer mode: documents are read-only.</p>}

                    {documents.length === 0 ? (
                      <p style={staffMutedStyle}>No files uploaded for this job yet.</p>
                    ) : (
                      <div style={fileGridStyle}>
                        {documents.map((document) => {
                          const fileUrl = signedFileUrls[document.storage_path];
                          const isImage = isImageFile(document.file_name);

                          return (
                            <div key={document.id} style={fileCardStyle}>
                              {!fileUrl ? (
                                <div style={filePlaceholderStyle}>Preparing secure link...</div>
                              ) : isImage ? (
                                <a href={fileUrl} target="_blank" rel="noreferrer">
                                  <Image src={fileUrl} alt={document.file_name} width={180} height={140} unoptimized style={thumbnailStyle} />
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

                              <div style={{ fontSize: "12px", marginTop: "4px" }}>{formatDisplayLabel(document.document_type)}</div>
                              <div style={{ fontSize: "12px", color: "#555555" }}>{new Date(document.created_at).toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {isAdmin && (
                <section style={staffDropdownSectionStyle}>
                  <button
                    type="button"
                    className="staff-dropdown-header-button"
                    onClick={() => setCorrectionToolsOpen(!correctionToolsOpen)}
                    style={staffDropdownHeaderButtonStyle}
                    aria-expanded={correctionToolsOpen}
                  >
                    <span>
                      <span style={staffDropdownTitleStyle}>Correction Tools</span>
                      <span style={staffDropdownSubtitleStyle}>Admin-only reset tools</span>
                    </span>
                    <span style={staffDropdownChevronStyle}>{correctionToolsOpen ? "⌃" : "⌄"}</span>
                  </button>

                  {correctionToolsOpen && (
                    <div style={staffDropdownPanelStyle}>
                      <p style={staffMutedStyle}>Use these only to correct mistakes. Resetting a job clears later workflow fields so the gate engine can recalculate the correct status.</p>

                      <div style={staffButtonRowStyle}>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("membership_needed", "Membership Needed")}>Reset to Membership Needed</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("site_fee_needed", "Site Fee Needed")}>Reset to Site Fee Needed</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("site_visit_needed", "Site Visit Needed")}>Reset to Site Visit Needed</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("estimate_needed", "Estimate Needed")}>Reset to Estimate Needed</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("awaiting_deposit", "Awaiting Deposit")}>Reset to Awaiting Deposit</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("ready_for_construction", "Ready for Construction")}>Reset to Ready for Construction</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("waiting_on_inspection", "Waiting on Inspection")}>Reset to Waiting on Inspection</ActionButton>
                        <ActionButton disabled={updating || !selectedJobNumber} onClick={() => resetJobToStage("final_billing", "Final Billing")}>Reset to Final Billing</ActionButton>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </section>

        <aside style={staffSnapshotCardStyle}>
          {selectedJobNumber && selectedJobDetail ? (
            <>
              <div style={staffPanelHeaderStyle}>
                <div>
                  <h2 style={staffSectionTitleStyle}>Job Snapshot</h2>
                  <p style={staffMutedStyle}>Fast reference for staff</p>
                </div>
                {renderGateBadge(selectedJobDetail.gate_status)}
              </div>

              <div style={staffSnapshotGridStyle}>
                <Detail label="Applicant" value={selectedJobDetail.applicant_name} />
                <Detail label="Member #" value={selectedJobDetail.member_number} />
                <Detail label="Phone" value={selectedJobDetail.phone} />
                <Detail label="Email" value={selectedJobDetail.email} />
                <Detail label="Job Type" value={formatDisplayLabel(selectedJobDetail.job_type)} />
                <Detail label="Work Order #" value={selectedJobDetail.work_order_number} />
                <Detail label="Inquiry Date" value={formatDate(selectedJobDetail.inquiry_date)} />
                <Detail label="Current Stage" value={selectedStageLabel} />
                <Detail label="Membership" value={formatDisplayLabel(selectedJobDetail.membership_status)} />
                <Detail label="Site Fee" value={formatDisplayLabel(selectedJobDetail.site_fee_status)} />
                <Detail label="Site Visit" value={formatDateTime(selectedJobDetail.site_visit_at)} />
                <Detail label="Estimate" value={formatDisplayLabel(selectedJobDetail.estimate_status)} />
                <Detail label="Estimate Amount" value={`$${formatMoney(selectedJobDetail.estimate_amount)}`} />
                <Detail
                  label="Deposit"
                  value={`Required: $${formatMoney(selectedJobDetail.deposit_required)}, Received: $${formatMoney(selectedJobDetail.deposit_received)}`}
                />
                <Detail label="Construction" value={formatDisplayLabel(selectedJobDetail.construction_status)} />
                <Detail label="Inspection Received" value={selectedJobDetail.inspection_received ? "Yes" : "No"} />
                <Detail label="Inspection Date" value={formatDateTime(selectedJobDetail.inspection_received_at)} />
                <Detail label="Final Payment / Refund" value={`$${formatMoney(selectedJobDetail.final_bill_amount)}`} />
                <Detail label="Final Payment Complete" value={selectedJobDetail.final_payment_received ? "Yes" : "No"} />
                <Detail label="Energized" value={formatDateTime(selectedJobDetail.energized_at)} />
              </div>

              <div style={staffQuickActionsCardStyle}>
                <h3 style={staffSmallTitleStyle}>Quick Actions</h3>
                <button type="button" onClick={printJobPacket} style={staffFullButtonStyle}>
                  Print / Save Job Packet
                </button>

                {canEdit && (
                  <button type="button" onClick={() => setShowEditInfoForm(!showEditInfoForm)} style={staffFullButtonStyle}>
                    {showEditInfoForm ? "Hide Edit Job Info" : "Edit Job Info"}
                  </button>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={generateMemberAccessLink}
                    disabled={updating || !selectedJobNumber}
                    style={staffFullButtonStyle}
                  >
                    Generate Member Access Link
                  </button>
                )}

                {memberAccessLink && (
                  <label style={labelStyle}>
                    Member Access Link
                    <input
                      value={memberAccessLink}
                      readOnly
                      onFocus={(event) => event.target.select()}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(memberAccessLink)}
                      style={staffSmallButtonStyle}
                    >
                      Copy Link
                    </button>
                  </label>
                )}
              </div>
            </>
          ) : (
            <div style={staffEmptySnapshotStyle}>
              <h2 style={staffSectionTitleStyle}>Job Snapshot</h2>
              <p style={staffMutedStyle}>Select a job to see member details and quick actions.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}


function StaffGlobalStyles() {
  return (
    <style>{`
      body,
      button,
      input,
      select,
      textarea,
      h1,
      h2,
      h3,
      h4,
      p,
      label,
      div,
      span,
      table,
      th,
      td {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
      }

      h1,
      h2,
      h3,
      h4 {
        font-weight: 850 !important;
        letter-spacing: -0.35px;
      }

      button,
      input,
      select,
      textarea {
        font-size: 15px;
      }

        .staff-job-row-button {
          border-radius: 8px !important;
          overflow: hidden !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          clip-path: inset(0 round 8px) !important;
        }

        .staff-job-row-button,
        .staff-job-row-button * {
          border-top-left-radius: 8px !important;
          border-top-right-radius: 8px !important;
          border-bottom-left-radius: 8px !important;
          border-bottom-right-radius: 8px !important;
        }

        .staff-dropdown-header-button {
          border-radius: 10px !important;
          overflow: hidden !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          clip-path: inset(0 round 10px) !important;
        }

    `}</style>
  );
}


const staffAppFontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

const staffPageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  background: "#f6f8f5",
  color: "#071f14",
  fontFamily: staffAppFontFamily,
};

const staffAuthShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "32px",
  background: "#f6f8f5",
  color: "#071f14",
  fontFamily: staffAppFontFamily,
};

const staffAuthCardStyle: React.CSSProperties = {
  width: "min(520px, 100%)",
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  padding: "28px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

const staffAuthBrandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  marginBottom: "22px",
};

const staffAuthLogoStyle: React.CSSProperties = {
  width: "96px",
  height: "96px",
  objectFit: "contain",
  borderRadius: "999px",
  background: "#ffffff",
  padding: "8px",
  border: "2px solid #e1e7e2",
};

const staffAuthFormStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const staffLoadingCardStyle: React.CSSProperties = {
  maxWidth: "520px",
  padding: "30px",
  background: "#ffffff",
  borderRadius: "10px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

const staffLoadingTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  margin: 0,
  fontSize: "32px",
  fontWeight: 850,
};

const staffTopBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "22px 24px",
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

const staffBrandHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
};

const staffLogoStyle: React.CSSProperties = {
  width: "78px",
  height: "78px",
  objectFit: "contain",
  borderRadius: "999px",
  background: "#ffffff",
  padding: "6px",
  border: "2px solid #e1e7e2",
  boxShadow: "0 8px 20px rgba(20, 53, 40, 0.14)",
};

const staffPageTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  margin: 0,
  fontSize: "32px",
  lineHeight: 1.05,
  letterSpacing: "-0.8px",
  fontWeight: 850,
  color: "#071f14",
};

const staffPageSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#4d5a53",
  fontWeight: 600,
};

const staffUserLineStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "13px",
  color: "#607168",
};

const staffTopActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const staffMessageStyle: React.CSSProperties = {
  margin: "18px 0 0",
  padding: "14px 16px",
  border: "1px solid #e1e7e2",
  background: "#ffffff",
  color: "#111111",
  borderRadius: "16px",
};

const staffSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  marginTop: "14px",
};

const dashboardCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  padding: "16px 20px",
  minHeight: "68px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  boxShadow: "0 10px 24px rgba(0,0,0,0.045)",
};

const dashboardTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  color: "#071f14",
  fontSize: "20px",
  lineHeight: 1.1,
  fontWeight: 850,
  letterSpacing: "-0.3px",
};

const dashboardValueStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  color: "#4d5a53",
  fontSize: "30px",
  lineHeight: 1,
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const staffDesktopGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "420px minmax(520px, 1fr) 360px",
  gap: "22px",
  alignItems: "start",
  marginTop: "22px",
};

const staffJobQueueCardStyle: React.CSSProperties = {
  position: "sticky",
  top: "20px",
  maxHeight: "calc(100vh - 40px)",
  overflow: "auto",
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  padding: "22px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

const staffCenterColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "18px",
  minWidth: 0,
};

const staffSnapshotCardStyle: React.CSSProperties = {
  position: "sticky",
  top: "20px",
  maxHeight: "calc(100vh - 40px)",
  overflow: "auto",
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  padding: "22px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

const staffPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  marginBottom: "16px",
};

const staffSectionTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  margin: 0,
  fontSize: "22px",
  color: "#071f14",
  fontWeight: 850,
  letterSpacing: "-0.3px",
};

const staffSmallTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  margin: "0 0 12px",
  fontSize: "17px",
  color: "#071f14",
  fontWeight: 850,
};

const staffMutedStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#5f6b64",
  fontSize: "14px",
};

const staffPrimaryButtonStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "12px 18px",
  cursor: "pointer",
  background: "#21843b",
  color: "#ffffff",
  border: "1px solid #16682d",
  borderRadius: "10px",
  fontWeight: 850,
  boxShadow: "0 10px 22px rgba(33,132,59,0.18)",
};

const staffSecondaryButtonStyle: React.CSSProperties = {
  marginTop: 0,
  padding: "11px 16px",
  cursor: "pointer",
  background: "#ffffff",
  color: "#071f14",
  border: "1px solid #d6e9da",
  borderRadius: "10px",
  fontWeight: 800,
};

const staffSmallButtonStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  background: "#f4f7f5",
  color: "#071f14",
  border: "1px solid #d8e3dc",
  borderRadius: "8px",
  fontWeight: 800,
};

const staffFullButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  cursor: "pointer",
  background: "#ffffff",
  color: "#071f14",
  border: "1px solid #d8e3dc",
  borderRadius: "10px",
  fontWeight: 800,
  textAlign: "left",
};

const staffFullWidthCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  padding: "22px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.07)",
};

const staffSelectedJobHeaderStyle: React.CSSProperties = {
  ...staffFullWidthCardStyle,
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
};

const staffEyebrowStyle: React.CSSProperties = {
  margin: "0 0 6px",
  color: "#21843b",
  fontWeight: 850,
  fontSize: "13px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const staffSelectedJobTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  margin: 0,
  fontSize: "28px",
  lineHeight: 1.08,
  letterSpacing: "-0.6px",
  color: "#071f14",
  fontWeight: 850,
};

const staffStageBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "9px 14px",
  background: "#e7f3ea",
  border: "1px solid #d6e9da",
  color: "#21843b",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const staffWorkflowCardStyle: React.CSSProperties = {
  ...staffFullWidthCardStyle,
  background: "#fbfdfb",
};

const staffNextActionCardStyle: React.CSSProperties = {
  ...staffFullWidthCardStyle,
  background: "linear-gradient(135deg, #ffffff, #ffffff)",
  border: "1px solid #e1e7e2",
};

const staffFormGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const staffButtonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "16px",
};

const staffStackStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const staffJobListStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "18px",
};

const staffJobRowStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e1e7e2",
  background: "#ffffff",
  color: "#071f14",
  borderRadius: "8px",
  padding: "14px 16px",
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gap: "6px",
  transition: "background 180ms ease, border 180ms ease, box-shadow 180ms ease",
  overflow: "hidden",
  appearance: "none",
  WebkitAppearance: "none",
};

const staffJobRowSelectedStyle: React.CSSProperties = {
  background: "#f0f8f1",
  border: "1px solid #b8dfc1",
  borderRadius: "8px",
  boxShadow: "inset 4px 0 0 #21843b",
};

const staffJobRowFlashStyle: React.CSSProperties = {
  background: "#edf6ef",
  border: "1px solid #b8dfc1",
  borderRadius: "8px",
};

const staffJobRowTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const staffJobApplicantStyle: React.CSSProperties = {
  fontWeight: 850,
  fontSize: "16px",
};

const staffJobMetaStyle: React.CSSProperties = {
  color: "#5f6b64",
  fontSize: "13px",
};

const staffJobNextActionStyle: React.CSSProperties = {
  color: "#143528",
  fontSize: "13px",
  fontWeight: 700,
};

const staffSnapshotGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const staffQuickActionsCardStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "16px",
  borderRadius: "18px",
  border: "1px solid #d8e3dc",
  background: "#fbfdfb",
  display: "grid",
  gap: "10px",
};

const staffEmptySnapshotStyle: React.CSSProperties = {
  padding: "12px",
};

const staffDropdownSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const staffDropdownHeaderButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 18px",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#071f14",
  cursor: "pointer",
  textAlign: "left",
  boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
};

const staffDropdownTitleStyle: React.CSSProperties = {
  fontFamily: staffAppFontFamily,
  display: "block",
  fontSize: "20px",
  fontWeight: 850,
  color: "#143528",
};

const staffDropdownSubtitleStyle: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  fontSize: "13px",
  color: "#607168",
  fontWeight: 600,
};

const staffDropdownChevronStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  display: "grid",
  placeItems: "center",
  background: "#edf6ef",
  color: "#21843b",
  fontSize: "20px",
  fontWeight: 900,
  flex: "0 0 auto",
};

const staffDropdownPanelStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "16px",
  border: "1px solid #e1e7e2",
  borderRadius: "10px",
  background: "#ffffff",
};

function canShowConstructionControls(job: JobDetail | null) {
  if (!job) return false;
  return [
    "ready_for_construction",
    "in_construction",
    "waiting_on_material",
    "waiting_on_member",
    "waiting_on_easement",
    "waiting_on_inspection",
    "final_billing",
    "closed_energized",
  ].includes(job.current_stage);
}
function getNextActions(
  job:
    | (JobListItem & {
        estimate_status?: string | null;
        estimate_amount?: number | null;
        deposit_required?: number | null;
      })
    | undefined
): WorkflowAction[] {
  if (!job) return [];

  switch (job.current_stage) {
    case "membership_needed":
      return [{ id: "membership_complete", label: "Mark Membership Complete" }];

    case "site_fee_needed":
      return [{ id: "site_fee_paid", label: "Mark Site Fee Paid" }];

    case "site_visit_needed":
      return [{ id: "set_site_visit", label: "Set Site Visit Date" }];

    case "estimate_needed":
      if (job.estimate_status === "sent") {
        const amount = Number(job.estimate_amount ?? 0);
        const required = Number(job.deposit_required ?? 0);

        if (amount === 0 || required === 0) {
          return [];
        }

        return [{ id: "estimate_signed", label: "Mark Estimate Signed" }];
      }

      return [{ id: "estimate_sent", label: "Mark Estimate Sent" }];

    case "awaiting_deposit":
      return [{ id: "deposit_received", label: "Update Deposit Received" }];

    case "ready_for_construction":
      return [{ id: "construction_in_progress", label: "Mark Construction In Progress" }];

    case "in_construction":
      return [{ id: "construction_complete", label: "Mark Construction Complete" }];

    case "waiting_on_inspection":
      return [{ id: "inspection_received", label: "Mark Inspection Received" }];

    case "final_billing":
      if (job.gate_message === "STOP - Final Payment not received") {
        return [{ id: "final_payment_received", label: "Mark Final Payment Received" }];
      }

      if (job.gate_message === "GO - Energize Service") {
        return [{ id: "energized_closed", label: "Mark Energized / Closed" }];
      }

      return [];

    default:
      return [];
  }
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const numberValue = Number(cleaned);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue * 100) / 100;
}

function parseSignedMoney(value: string) {
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const numberValue = Number(cleaned);
  if (!Number.isFinite(numberValue)) return null;
  return Math.round(numberValue * 100) / 100;
}

function formatMoney(value: number | null) {
  return Number(value ?? 0).toFixed(2);
}

function mmDdYyyyToIso(value: string, utcHour: number) {
  const trimmed = value.trim();
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (testDate.getUTCFullYear() !== year || testDate.getUTCMonth() !== month - 1 || testDate.getUTCDate() !== day) return null;

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

function formatDisplayLabel(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bOmec\b/g, "OMEC")
    .replace(/\bGo\b/g, "GO")
    .replace(/\bStop\b/g, "STOP")
    .replace(/\bNsr\b/g, "NSR");
}

function getGateIcon(gateStatus: string | null | undefined) {
  const status = (gateStatus || "").toLowerCase();
  if (status === "stop") return "🛑";
  if (status === "go") return "🟢";
  if (status === "closed") return "🚪";
  if (status === "watch") return "🟡";
  return "⚪";
}

function renderGateBadge(gateStatus: string | null | undefined, gateMessage?: string | null) {
  const label = formatDisplayLabel(gateStatus);
  return (
    <span style={gateBadgeStyle}>
      <span style={{ fontSize: "18px" }}>{getGateIcon(gateStatus)}</span>
      <span>
        <strong>{label}</strong>
        {gateMessage ? ` — ${gateMessage}` : ""}
      </span>
    </span>
  );
}

function formatActivityValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return String(value);
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "12px", color: "#555", fontWeight: 700 }}>{label}</div>
      <div>{value || "-"}</div>
    </div>
  );
}

function DetailWide({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ fontSize: "12px", color: "#555", fontWeight: 700 }}>{label}</div>
      <div style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{value || "-"}</div>
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div style={dashboardCardStyle}>
      <span style={dashboardTitleStyle}>{title}</span>
      <span style={dashboardValueStyle}>{value}</span>
    </div>
  );
}

function FormInput({ label, value, required, onChange }: { label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
    </label>
  );
}

function ActionButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#cccccc" : "#1f4d3a",
        color: disabled ? "#666666" : "#ffffff",
        border: "1px solid #143528",
        borderRadius: "999px",
      }}
    >
      {children}
    </button>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th style={{ borderBottom: "2px solid #ccc", textAlign: "left", padding: "10px", background: "#e3efe8", color: "#143528" }}>{children}</th>;
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td style={{ borderBottom: "1px solid #eeeeee", padding: "10px", verticalAlign: "top", color: "#111111" }}>{children}</td>;
}

const mainStyle: React.CSSProperties = { padding: "40px", fontFamily: "Arial, sans-serif", background: "transparent", color: "#111111", minHeight: "100vh" };
const brandHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" };
const logoStyle: React.CSSProperties = { width: "84px", height: "84px", objectFit: "contain", borderRadius: "999px", background: "#ffffff", padding: "6px", border: "2px solid #e1e7e2", boxShadow: "0 8px 20px rgba(20, 53, 40, 0.18)" };
const topBarStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" };
const messageStyle: React.CSSProperties = { padding: "12px", border: "1px solid #e1e7e2", background: "#ffffff", color: "#111111", borderRadius: "12px" };
const dashboardGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginTop: "24px" };

const buttonRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "16px" };
const detailCardStyle: React.CSSProperties = { marginTop: "16px", padding: "16px", border: "1px solid #e1e7e2", background: "#ffffff", color: "#111111", borderRadius: "14px" };
const detailGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" };
const noteCardStyle: React.CSSProperties = { padding: "12px", border: "1px solid #e1e7e2", background: "#ffffff", borderRadius: "12px" };
const activityCardStyle: React.CSSProperties = { padding: "12px", border: "1px solid #e1e7e2", background: "#ffffff", borderRadius: "12px" };
const dropdownHeaderButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "18px 20px",
  border: "1px solid #e1e7e2",
  borderRadius: "16px",
  background: "#ffffff",
  color: "#111111",
  cursor: "pointer",
  textAlign: "left",
  boxShadow: "0 10px 24px rgba(20, 53, 40, 0.08)",
};

const dropdownTitleStyle: React.CSSProperties = {
  display: "block",
  fontSize: "22px",
  fontWeight: 800,
  color: "#143528",
};

const dropdownSubtitleStyle: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  fontSize: "13px",
  color: "#555555",
  fontWeight: 600,
};

const dropdownChevronStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "#e3efe8",
  color: "#143528",
  fontSize: "22px",
  fontWeight: 900,
  flex: "0 0 auto",
};

const dropdownPanelStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "16px",
  border: "1px solid #e1e7e2",
  borderRadius: "16px",
  background: "#ffffff",
};
const activityDetailsStyle: React.CSSProperties = { marginTop: "8px", padding: "10px", background: "#ffffff", border: "1px solid #ddd", fontSize: "13px", display: "grid", gap: "6px", borderRadius: "10px" };
const activityDetailRowStyle: React.CSSProperties = { display: "flex", gap: "6px", flexWrap: "wrap" };
const fileGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px", marginTop: "12px" };
const fileCardStyle: React.CSSProperties = { border: "1px solid #e1e7e2", padding: "10px", background: "#ffffff", color: "#111111", borderRadius: "12px" };
const thumbnailStyle: React.CSSProperties = { width: "100%", height: "140px", objectFit: "cover", border: "1px solid #ccc", marginBottom: "8px", background: "#ffffff", borderRadius: "10px" };
const filePlaceholderStyle: React.CSSProperties = { height: "140px", border: "1px solid #ccc", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", textAlign: "center", padding: "8px", color: "#111111", borderRadius: "10px" };
const gateBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 10px", borderRadius: "999px", background: "#ffffff", border: "1px solid #e1e7e2", whiteSpace: "normal" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: "12px", background: "#ffffff", color: "#111111" };