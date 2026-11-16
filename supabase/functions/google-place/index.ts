import { createClient } from "npm:@supabase/supabase-js@2";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
const server = createClient(projectUrl, serviceKey, { auth: { persistSession: false } });
const allowedOrigin = Deno.env.get("GOOGLE_PLACES_SITE_ORIGIN") || "https://ixsaturnxi.github.io";
const googleBase = "https://places.googleapis.com/v1/";

function limit(name: string) {
    const value = Number(Deno.env.get(name) || "0");
    return Number.isInteger(value) && value >= 0 && value <= 386 ? value : 0;
}

const detailsLimit = limit("GOOGLE_PLACES_DETAILS_LIMIT");
const photoLimit = limit("GOOGLE_PLACES_PHOTOS_LIMIT");

async function reserve(sku: "details" | "photo", max: number) {
    if (!max) return false;
    const { data, error } = await server.rpc("reserve_google_places_request", {
        p_sku: sku,
        p_limit: max,
    });
    if (error) throw new Error("Unable to reserve Places quota");
    return data === true;
}

function placeIdFor(place: { google_place_id?: string; "google map"?: string; google_map?: string }) {
    let id = place.google_place_id?.trim();
    if (!id) {
        try {
            const url = new URL(place.google_map || place["google map"] || "");
            if (url.protocol === "https:" && ["www.google.com", "maps.google.com", "google.com"].includes(url.hostname)) {
                id = url.searchParams.get("query_place_id") || undefined;
            }
        } catch {
            return null;
        }
    }
    return id && /^[A-Za-z0-9_-]{8,300}$/.test(id) ? id : null;
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
    if (!googleKey || !detailsLimit) return respond({ code: "disabled" }, 503);

    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return respond({ code: "login" }, 401);
    const { data: { user }, error: loginError } = await server.auth.getUser(token);
    if (loginError || !user || user.is_anonymous) return respond({ code: "login" }, 401);

    try {
        const body = await request.json().catch(() => null);
        const localId = String(body?.id ?? "");
        if (!/^\d{1,19}$/.test(localId)) return respond({ code: "bad_id" }, 400);

        const { data: place, error } = await server.from("places").select("*")
            .eq("id", localId).eq("is_mock", false).maybeSingle();
        if (error) throw new Error("Place lookup failed");
        const id = place && placeIdFor(place);
        if (!id) return respond({ code: "no_place_id" }, 404);
        if (!await reserve("details", detailsLimit)) return respond({ code: "quota" }, 429);

        const detailsResponse = await fetch(googleBase + "places/" + id, {
            headers: {
                "X-Goog-Api-Key": googleKey,
                "X-Goog-FieldMask": "displayName,formattedAddress,nationalPhoneNumber,regularOpeningHours,priceRange,googleMapsUri,photos,attributions",
            },
            redirect: "error",
            signal: AbortSignal.timeout(8000),
        });
        if (!detailsResponse.ok) return respond({ code: "google_error" }, 502);
        const details = await detailsResponse.json();

        const photo = details.photos?.[0];
        let photoUri = null;
        if (photo?.name && /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)
            && await reserve("photo", photoLimit)) {
            // Return Google's temporary media URL, never persist it or forward the API key.
            const photoUrl = new URL(googleBase + photo.name + "/media");
            photoUrl.search = new URLSearchParams({ maxWidthPx: "800", skipHttpRedirect: "true" }).toString();
            try {
                const media = await fetch(photoUrl, {
                    headers: { "X-Goog-Api-Key": googleKey },
                    redirect: "error",
                    signal: AbortSignal.timeout(8000),
                });
                if (media.ok) photoUri = (await media.json()).photoUri || null;
            } catch {
                // Details are still usable if the optional image request fails.
            }
        }

        return respond({
            name: details.displayName?.text,
            address: details.formattedAddress,
            phone: details.nationalPhoneNumber,
            hours: details.regularOpeningHours?.weekdayDescriptions,
            price: details.priceRange,
            mapsUrl: details.googleMapsUri,
            attributions: details.attributions || [],
            photo: photoUri ? { uri: photoUri, authors: photo.authorAttributions || [] } : null,
        });
    } catch {
        return respond({ code: "server_error" }, 500);
    }
});
