import { createClient } from "npm:@supabase/supabase-js@2";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
const server = createClient(projectUrl, serviceKey, { auth: { persistSession: false } });
const allowedOrigin = Deno.env.get("GOOGLE_PLACES_SITE_ORIGIN") || "https://ixsaturnxi.github.io";
const googleBase = "https://places.googleapis.com/v1/";

const searchLimit = 54;
const detailsLimit = 500;
const photoLimit = 500;

async function reserve(sku: "details" | "photo", max: number) {
    if (!max) return false;
    const { data, error } = await server.rpc("reserve_google_places_request", {
        p_sku: sku,
        p_limit: max,
    });
    if (error) throw new Error("Unable to reserve Places quota");
    return data === true;
}

type Store = {
    id: number | string;
    name?: string;
    address?: string;
    google_place_id?: string;
    google_map?: string;
    "google map"?: string;
    lat?: number | string;
    lng?: number | string;
};
type Coordinates = { latitude: number; longitude: number };
type Candidate = {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: Coordinates;
};

function validPlaceId(value?: string) {
    return value && /^[A-Za-z0-9_-]{8,300}$/.test(value) ? value : null;
}

function placeIdFor(place: Store) {
    const saved = validPlaceId(place.google_place_id?.trim());
    if (saved) return saved;
    try {
        const url = new URL(place.google_map || place["google map"] || "");
        if (url.protocol === "https:" && ["www.google.com", "maps.google.com", "google.com"].includes(url.hostname)) {
            return validPlaceId(url.searchParams.get("query_place_id") || undefined);
        }
    } catch { /* This row has no usable Google Maps URL. */ }
    return null;
}

function storeCoordinates(place: Store): Coordinates | null {
    const url = (place.google_map || place["google map"] || "").replace(/%2C/ig, ",");
    const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const query = url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?=[&#]|$)/);
    const addressPoint = place.address?.match(/\((-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\)/);
    for (const pair of [[place.lat, place.lng], pin?.slice(1), query?.slice(1), addressPoint?.slice(1)]) {
        if (!pair || pair.some(value => value == null || String(value).trim() === "")) continue;
        const [latitude, longitude] = pair.map(Number);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)
            && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
    }
    return null;
}

function normalizeText(value?: string) {
    return (value || "").replace(/[·•]?\s*ลิงก์ที่เคยเข้าชม\s*$/u, "").normalize("NFKC").toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

function isNearby(origin: Coordinates, point?: Coordinates) {
    if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
    const north = (point.latitude - origin.latitude) * 111320;
    const east = (point.longitude - origin.longitude) * 111320 * Math.cos(origin.latitude * Math.PI / 180);
    return Math.hypot(north, east) <= 150;
}

function matchPlace(place: Store, candidates: Candidate[], coords: Coordinates | null) {
    const name = normalizeText(place.name);
    const address = normalizeText(place.address);
    const matches = new Set<string>();
    for (const candidate of candidates) {
        const id = validPlaceId(candidate.id);
        if (!id || normalizeText(candidate.displayName?.text) !== name) continue;
        const sameAddress = address.length >= 12 && /\d/.test(address)
            && normalizeText(candidate.formattedAddress) === address;
        if (coords ? isNearby(coords, candidate.location) : sameAddress) matches.add(id);
    }
    return matches.size === 1 ? [...matches][0] : null;
}

async function discoverPlace(place: Store) {
    const coords = storeCoordinates(place);
    const address = normalizeText(place.address);
    if (!normalizeText(place.name) || (!coords && (address.length < 12 || !/\d/.test(address)))) {
        return { code: "no_place_id" };
    }
    if (!searchLimit) return { code: "search_disabled" };

    const { data: claim, error } = await server.rpc("reserve_google_place_search", {
        p_place: place.id,
        p_limit: searchLimit,
    });
    if (error) throw new Error("Unable to reserve Places search quota");
    if (claim === "already_linked") {
        const { data: linked, error: readError } = await server.from("places").select("google_place_id")
            .eq("id", place.id).eq("is_mock", false).maybeSingle();
        if (readError) throw readError;
        return { id: validPlaceId(linked?.google_place_id) };
    }
    if (claim !== "reserved") return { code: String(claim || "no_place_id") };

    const response = await fetch(googleBase + "places:searchText", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleKey!,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
        },
        body: JSON.stringify({
            textQuery: [place.name?.replace(/[·•]?\s*ลิงก์ที่เคยเข้าชม\s*$/u, ""), place.address].filter(Boolean).join(" ").slice(0, 300),
            languageCode: "th",
            regionCode: "TH",
            pageSize: 10,
            ...(coords ? { locationBias: { circle: { center: coords, radius: 300 } } } : {}),
        }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { code: "google_error" };
    const result = await response.json();
    const id = matchPlace(place, Array.isArray(result.places) ? result.places : [], coords);
    if (!id) return { code: "no_place_id" };

    // Persist only the Place ID. Keep any mapping an administrator just set.
    const update = server.from("places").update({ google_place_id: id })
        .eq("id", place.id).eq("is_mock", false);
    const guardedUpdate = place.google_place_id == null
        ? update.is("google_place_id", null)
        : update.eq("google_place_id", place.google_place_id);
    const { data: linked, error: writeError } = await guardedUpdate.select("google_place_id").maybeSingle();
    if (writeError) throw writeError;
    if (linked) return { id: validPlaceId(linked.google_place_id) };
    const { data: current, error: readError } = await server.from("places").select("google_place_id")
        .eq("id", place.id).eq("is_mock", false).maybeSingle();
    if (readError) throw readError;
    return { id: validPlaceId(current?.google_place_id) };
}

type PlacePhoto = { name?: string; authorAttributions?: unknown[] };

async function fetchPhoto(photo: PlacePhoto | undefined) {
    if (!photo?.name || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)) {
        return { photo: null, photoStatus: "no_photo" };
    }
    if (!await reserve("photo", photoLimit)) return { photo: null, photoStatus: "quota" };

    // The resource comes directly from Google's authenticated response. It can
    // contain the canonical ID even when Details was called using an older ID.
    const url = new URL(googleBase + photo.name + "/media");
    url.search = new URLSearchParams({ maxWidthPx: "800", skipHttpRedirect: "true" }).toString();
    try {
        const media = await fetch(url, {
            headers: { "X-Goog-Api-Key": googleKey! },
            redirect: "error",
            signal: AbortSignal.timeout(8000),
        });
        const uri = media.ok ? (await media.json()).photoUri : null;
        if (uri) return { photo: { uri, authors: photo.authorAttributions || [] }, photoStatus: "available" };
    } catch {
        // A missing photo must not prevent the rest of the place data loading.
    }
    return { photo: null, photoStatus: "google_error" };
}

async function fetchPlacePhoto(id: string) {
    const metadata = await fetch(googleBase + "places/" + id, {
        headers: { "X-Goog-Api-Key": googleKey!, "X-Goog-FieldMask": "photos" },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
    });
    if (!metadata.ok) return { photo: null, photoStatus: "google_error" };
    return fetchPhoto((await metadata.json()).photos?.[0]);
}

Deno.serve(async (request) => {
    const origin = request.headers.get("origin");
    const headers = {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
    };
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (origin && origin !== allowedOrigin) return respond({ code: "origin" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return respond({ code: "method" }, 405);
    if (!googleKey) return respond({ code: "disabled" }, 503);

    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return respond({ code: "login" }, 401);
    const { data: { user }, error: loginError } = await server.auth.getUser(token);
    if (loginError || !user || user.is_anonymous) return respond({ code: "login" }, 401);

    try {
        const body = await request.json().catch(() => null);
        const photoOnly = body?.mode === "photo";
        const includePhoto = body?.includePhoto !== false;
        const localId = String(body?.id ?? "");
        if (!/^\d{1,19}$/.test(localId)) return respond({ code: "bad_id" }, 400);

        const { data: place, error } = await server.from("places").select("*")
            .eq("id", localId).eq("is_mock", false).maybeSingle();
        if (error) throw new Error("Place lookup failed");
        if (!place) return respond({ code: "no_place_id" }, 404);
        let id = placeIdFor(place);
        if (!id && photoOnly) return respond({ code: "no_place_id" }, 404);
        if (!id) {
            const discovered = await discoverPlace(place);
            id = discovered.id || null;
            if (!id) {
                const code = discovered.code || "no_place_id";
                return respond({ code }, code === "search_quota" ? 429
                    : code === "google_error" ? 502 : code === "search_disabled" ? 503 : 404);
            }
        }
        if (photoOnly) return respond({ placeId: id, ...await fetchPlacePhoto(id) });
        if (!await reserve("details", detailsLimit)) {
            return respond({ placeId: id, detailsStatus: "quota", ...(includePhoto ? await fetchPlacePhoto(id) : {}) });
        }

        const fields = "displayName,nationalPhoneNumber,formattedAddress,priceRange,currentOpeningHours,regularOpeningHours,businessStatus,googleMapsUri,attributions";
        const detailsResponse = await fetch(googleBase + "places/" + id + "?languageCode=th", {
            headers: {
                "X-Goog-Api-Key": googleKey,
                "X-Goog-FieldMask": includePhoto ? fields + ",photos" : fields,
            },
            redirect: "error",
            signal: AbortSignal.timeout(8000),
        });
        if (!detailsResponse.ok) return respond({ code: "google_error" }, 502);
        const details = await detailsResponse.json();

        return respond({
            placeId: id,
            name: details.displayName?.text,
            phone: details.nationalPhoneNumber,
            address: details.formattedAddress,
            priceRange: details.priceRange,
            hours: details.currentOpeningHours?.weekdayDescriptions?.length
                ? details.currentOpeningHours.weekdayDescriptions
                : details.regularOpeningHours?.weekdayDescriptions,
            hoursType: details.currentOpeningHours?.weekdayDescriptions?.length ? "current" : "regular",
            openNow: details.currentOpeningHours?.openNow,
            nextOpenTime: details.currentOpeningHours?.nextOpenTime,
            nextCloseTime: details.currentOpeningHours?.nextCloseTime,
            businessStatus: details.businessStatus,
            fetchedAt: new Date().toISOString(),
            mapsUrl: details.googleMapsUri,
            attributions: details.attributions || [],
            ...(includePhoto ? await fetchPhoto(details.photos?.[0]) : {}),
        });
    } catch {
        return respond({ code: "server_error" }, 500);
    }
});
