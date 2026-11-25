import { supabase } from "@/integrations/supabase/client";
import { getAgencyId, loadAgencyContext } from "@/lib/services";

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
  { value: "imagem", label: "Imagem" },
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
  clientId?: string | null;
  category?: string | null;
}): Promise<LeadDocument | null> {
  const { file, agencyId, leadId, itineraryId, activityId, clientId, category } = params;
  const id = crypto.randomUUID();
  const scope = leadId
    ? leadId
    : clientId
      ? `client/${clientId}`
      : "geral";
  const path = `${agencyId}/${scope}/${id}-${sanitize(file.name)}`;

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

/** Link an existing agency document (from the library) to an activity by copying its stored file. */
export async function attachLibraryDocumentToActivity(params: {
  source: LeadDocument;
  agencyId: string;
  leadId?: string | null;
  itineraryId?: string | null;
  activityId: string;
}): Promise<LeadDocument | null> {
  const { source, agencyId, leadId, itineraryId, activityId } = params;
  const id = crypto.randomUUID();
  const path = `${agencyId}/${leadId || "geral"}/${id}-${sanitize(source.name)}`;

  const { error: copyErr } = await supabase.storage.from(BUCKET).copy(source.file_path, path);
  if (copyErr) {
    console.error("copy doc", copyErr);
    throw new Error("Não foi possível copiar o arquivo da biblioteca.");
  }

  const { data, error } = await db()
    .from("crm_lead_documents")
    .insert({
      id,
      agency_id: agencyId,
      lead_id: leadId ?? null,
      itinerary_id: itineraryId ?? null,
      activity_id: activityId,
      name: source.name,
      category: source.category ?? null,
      file_path: path,
      mime_type: source.mime_type ?? null,
      size: source.size ?? null,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    console.error("insert linked doc", error);
    throw new Error("Não foi possível anexar o documento.");
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

export async function fetchItineraryDocuments(itineraryId: string): Promise<LeadDocument[]> {
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("*")
    .eq("itinerary_id", itineraryId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as unknown as LeadDocument[]) || [];
}

/** Documents attached directly to a client (uploaded from the client profile). */
export async function fetchClientDocuments(clientId: string, agencyId: string): Promise<LeadDocument[]> {
  const prefix = `${agencyId}/client/${clientId}/`;
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("*")
    .is("lead_id", null)
    .eq("agency_id", agencyId)
    .like("file_path", `${prefix}%`)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as unknown as LeadDocument[]) || [];
}




/** MIME marker used to store an external link instead of an uploaded file. */
export const LINK_MIME = "text/uri-list";

export function isLinkDoc(doc: { mime_type?: string | null }): boolean {
  return doc.mime_type === LINK_MIME;
}

export function getLinkUrl(doc: LeadDocument): string | null {
  return isLinkDoc(doc) ? doc.file_path : null;
}

/** Save an external link (URL) as a document attached to a lead/itinerary/activity. */
export async function addLinkDocument(params: {
  url: string;
  name: string;
  agencyId: string;
  leadId?: string | null;
  itineraryId?: string | null;
  activityId?: string | null;
  category?: string | null;
}): Promise<LeadDocument | null> {
  const { url, name, agencyId, leadId, itineraryId, activityId, category } = params;
  const id = crypto.randomUUID();
  const { data, error } = await db()
    .from("crm_lead_documents")
    .insert({
      id,
      agency_id: agencyId,
      lead_id: leadId ?? null,
      itinerary_id: itineraryId ?? null,
      activity_id: activityId ?? null,
      name: name || url,
      category: category ?? null,
      file_path: url,
      mime_type: LINK_MIME,
      size: null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("insert link doc", error);
    throw new Error("Não foi possível salvar o link.");
  }
  return data as unknown as LeadDocument;
}

export async function deleteLeadDocument(doc: LeadDocument): Promise<boolean> {
  if (!isLinkDoc(doc)) await supabase.storage.from(BUCKET).remove([doc.file_path]);
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

/**
 * Remove all documents attached to an itinerary (roteiro), deleting both the
 * stored files and the rows. Called when clearing a roteiro so library images
 * stop being locked as "in use".
 */
export async function deleteItineraryDocuments(itineraryId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("id, file_path")
    .eq("itinerary_id", itineraryId);
  if (error) {
    console.error("deleteItineraryDocuments select", error);
    return false;
  }
  const rows = (data as unknown as { id: string; file_path: string }[]) || [];
  if (rows.length === 0) return true;
  const paths = rows.map((r) => r.file_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error: delErr } = await db()
    .from("crm_lead_documents")
    .delete()
    .eq("itinerary_id", itineraryId);
  if (delErr) {
    console.error("deleteItineraryDocuments delete", delErr);
    return false;
  }
  return true;
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

/**
 * Check whether a library document is currently attached to any roteiro
 * (itinerary day/activity). Attaching from the library copies the file into a
 * new row with `activity_id`/`itinerary_id` set, sharing the same name/size.
 * Returns the titles of the roteiros where it is attached.
 */
export async function findItineraryAttachments(doc: LeadDocument): Promise<string[]> {
  let q = db()
    .from("crm_lead_documents")
    .select("id, itinerary:crm_itineraries(title)")
    .eq("agency_id", doc.agency_id)
    .eq("name", doc.name)
    .not("itinerary_id", "is", null)
    .neq("id", doc.id);
  q = doc.size == null ? q.is("size", null) : q.eq("size", doc.size);
  const { data, error } = await q;
  if (error) {
    console.error("findItineraryAttachments", error);
    return [];
  }
  const rows = (data as unknown as { itinerary?: { title?: string } | null }[]) || [];
  const titles = rows
    .map((r) => r.itinerary?.title)
    .filter((t): t is string => Boolean(t));
  return Array.from(new Set(titles));
}

/** Stable key to match a general library doc against its roteiro copies. */
export function documentKey(doc: { name: string; size?: number | null }): string {
  return `${doc.name}::${doc.size ?? "null"}`;
}

/** A roteiro where a library document is attached. */
export interface ItineraryAttachment {
  id: string;
  title: string;
}

/**
 * Fetch a map of roteiro-attached documents for the agency, keyed by name+size,
 * with the roteiros (id + title) where each is attached. Used to lock deletion
 * in the library before the user clicks Excluir.
 */
export async function fetchItineraryAttachmentMap(): Promise<Record<string, ItineraryAttachment[]>> {
  const agencyId = getAgencyId() ?? (await loadAgencyContext())?.agency_id ?? null;
  if (!agencyId) return {};
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("name, size, itinerary_id, itinerary:crm_itineraries(title)")
    .eq("agency_id", agencyId)
    .not("itinerary_id", "is", null);
  if (error) {
    console.error("fetchItineraryAttachmentMap", error);
    return {};
  }
  const rows =
    (data as unknown as {
      name: string;
      size: number | null;
      itinerary_id: string;
      itinerary?: { title?: string } | null;
    }[]) || [];
  const map: Record<string, ItineraryAttachment[]> = {};
  for (const r of rows) {
    const key = documentKey(r);
    if (!map[key]) map[key] = [];
    if (r.itinerary_id && !map[key].some((a) => a.id === r.itinerary_id)) {
      map[key].push({ id: r.itinerary_id, title: r.itinerary?.title || "Roteiro" });
    }
  }
  return map;
}

export interface AgencyDocument extends LeadDocument {
  lead?: { name: string } | null;
  itinerary?: { title: string } | null;
}

export type DocumentOrigin = "roteiro" | "lead" | "geral";

export function documentOrigin(doc: AgencyDocument): DocumentOrigin {
  if (doc.itinerary_id) return "roteiro";
  if (doc.lead_id) return "lead";
  return "geral";
}

/** All documents uploaded across the agency (leads, roteiros, avulsos). */
export async function fetchAgencyDocuments(): Promise<AgencyDocument[]> {
  const agencyId = getAgencyId() ?? (await loadAgencyContext())?.agency_id ?? null;
  if (!agencyId) throw new Error("Agência não encontrada.");
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("*, lead:crm_leads(name), itinerary:crm_itineraries(title)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchAgencyDocuments", error);
    // Throw instead of returning [] so React Query keeps previous data and
    // surfaces a retryable error, never a false "no documents" state.
    throw error;
  }
  return (data as unknown as AgencyDocument[]) || [];
}

/** Find any existing document in the agency with the same name and size (avoids duplicates). */
export async function findDuplicateGeneralDocument(
  agencyId: string,
  name: string,
  size: number | null,
): Promise<LeadDocument | null> {
  let q = db()
    .from("crm_lead_documents")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("name", name);
  q = size == null ? q.is("size", null) : q.eq("size", size);
  const { data, error } = await q.limit(1);
  if (error) return null;
  const rows = (data as unknown as LeadDocument[]) || [];
  return rows[0] ?? null;
}

/** Upload a general (repository) document not tied to a lead/roteiro. */
export async function uploadGeneralDocument(
  file: File,
  category?: string | null,
): Promise<{ document: LeadDocument | null; duplicate: boolean }> {
  const agencyId = getAgencyId() ?? (await loadAgencyContext())?.agency_id ?? null;
  if (!agencyId) throw new Error("Agência não encontrada.");
  const existing = await findDuplicateGeneralDocument(agencyId, file.name, file.size);
  if (existing) return { document: existing, duplicate: true };
  const document = await uploadLeadDocument({ file, agencyId, category });
  return { document, duplicate: false };
}

/** Normalized key for matching a library image against roteiro attachments (name without extension). */
export function libraryImageName(item: { file_name?: string | null; title?: string | null }): string {
  const raw = (item.file_name || item.title || "").toLowerCase();
  return raw.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "").trim();
}

/**
 * Map of image names currently attached to any roteiro (itinerary), keyed by the
 * same normalized name used by `libraryImageName`. Lets the library lock images
 * that are in use so they can't be deleted/edited/selected.
 */
export async function fetchLibraryImageAttachmentMap(): Promise<Record<string, ItineraryAttachment[]>> {
  const agencyId = getAgencyId() ?? (await loadAgencyContext())?.agency_id ?? null;
  if (!agencyId) return {};
  const { data, error } = await db()
    .from("crm_lead_documents")
    .select("name, mime_type, itinerary_id, itinerary:crm_itineraries(title)")
    .eq("agency_id", agencyId)
    .not("itinerary_id", "is", null);
  if (error) {
    console.error("fetchLibraryImageAttachmentMap", error);
    return {};
  }
  const rows =
    (data as unknown as {
      name: string;
      mime_type: string | null;
      itinerary_id: string;
      itinerary?: { title?: string } | null;
    }[]) || [];
  const map: Record<string, ItineraryAttachment[]> = {};
  for (const r of rows) {
    const isImage =
      (r.mime_type?.startsWith("image/") ?? false) ||
      /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(r.name || "");
    if (!isImage) continue;
    const key = libraryImageName({ file_name: r.name });
    if (!key) continue;
    if (!map[key]) map[key] = [];
    if (r.itinerary_id && !map[key].some((a) => a.id === r.itinerary_id)) {
      map[key].push({ id: r.itinerary_id, title: r.itinerary?.title || "Roteiro" });
    }
  }
  return map;
}
