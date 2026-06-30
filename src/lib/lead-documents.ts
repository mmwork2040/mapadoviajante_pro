import { supabase } from "@/integrations/supabase/client";

export interface LeadDocument {
  id: string;
  agency_id: string;
  lead_id: string | null;
  itinerary_id: string | null;
  activity_id: string | null;
  name: string;
  category: string | null;
  file_path: string;
  mime_type: string | null;
  size: number | null;
  created_at?: string;
}

export const DOCUMENT_CATEGORIES = [
  { value: "ingresso", label: "Ingresso" },
  { value: "passagem", label: "Passagem" },
  { value: "ticket", label: "Ticket" },
  { value: "voucher", label: "Voucher" },
  { value: "reserva", label: "Reserva" },
  { value: "seguro", label: "Seguro" },
  { value: "outro", label: "Outro" },
] as const;

const BUCKET = "trip-attachments";
// The new table is not yet in the generated Supabase types; cast to keep the build green.
const db = () => supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
};

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function uploadLeadDocument(params: {
  file: File;
  agencyId: string;
  leadId?: string | null;
  itineraryId?: string | null;
  activityId?: string | null;
  category?: string | null;
}): Promise<LeadDocument | null> {
  const { file, agencyId, leadId, itineraryId, activityId, category } = params;
  const id = crypto.randomUUID();
  const path = `${agencyId}/${leadId || "geral"}/${id}-${sanitize(file.name)}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) {
    console.error("upload doc", upErr);
    throw new Error("Não foi possível enviar o arquivo.");
  }

  const { data, error } = await db()
    .from("crm_lead_documents")
    .insert({
      id,
      agency_id: agencyId,
      lead_id: leadId ?? null,
      itinerary_id: itineraryId ?? null,
      activity_id: activityId ?? null,
      name: file.name,
      category: category ?? null,
      file_path: path,
      mime_type: file.type || null,
      size: file.size,
    })
    .select("*")
    .single();

  if (error) {
    // rollback the uploaded file to avoid orphans
    await supabase.storage.from(BUCKET).remove([path]);
    console.error("insert doc", error);
    throw new Error("Não foi possível salvar o documento.");
  }
  return data as unknown as LeadDocument;
}

export async function fetchActivityDocuments(activityId: string): Promise<LeadDocument[]> {
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as unknown as LeadDocument[]) || [];
}

export async function fetchLeadDocuments(leadId: string): Promise<LeadDocument[]> {
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as unknown as LeadDocument[]) || [];
}

export async function deleteLeadDocument(doc: LeadDocument): Promise<boolean> {
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await db().from("crm_lead_documents").delete().eq("id", doc.id);
  return !error;
}

export async function getDocumentUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Signed URL that forces a download (Content-Disposition: attachment). */
export async function getDownloadUrl(filePath: string, fileName?: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600, { download: fileName || true });
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function isImageDoc(doc: { mime_type?: string | null; name?: string }): boolean {
  if (doc.mime_type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(doc.name || "");
}

export function isPdfDoc(doc: { mime_type?: string | null; name?: string }): boolean {
  if (doc.mime_type === "application/pdf") return true;
  return /\.pdf$/i.test(doc.name || "");
}

/** Force a browser download of a stored document. */
export async function downloadDocument(doc: LeadDocument): Promise<boolean> {
  const url = await getDownloadUrl(doc.file_path, doc.name);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name || "documento";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
