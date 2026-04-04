import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Step 1: Get basic info from oEmbed (always works, no auth needed)
  let title = videoId;
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      title = oembed.title || videoId;
    }
  } catch { /* ignore */ }
  console.log("Video title:", title);

  // Step 2: Try to get captions via the page HTML
  let description = "";
  let captionTracks: any[] | null = null;

  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": "CONSENT=YES+1",
      },
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      console.log("HTML length:", html.length);

      // Try to extract ytInitialPlayerResponse JSON
      const playerMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|<\/script>)/s);
      if (playerMatch) {
        try {
          const playerData = JSON.parse(playerMatch[1]);
          description = playerData?.videoDetails?.shortDescription || "";
          captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
          console.log("Parsed ytInitialPlayerResponse, captions:", captionTracks?.length ?? 0);
        } catch (e) {
          console.log("Failed to parse ytInitialPlayerResponse:", e);
        }
      }

      // Fallback: try regex patterns directly on HTML
      if (!captionTracks) {
        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (captionMatch) {
          try { captionTracks = JSON.parse(captionMatch[1]); } catch { /* ignore */ }
        }
      }
      if (!description) {
        const descMatch = html.match(/"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (descMatch) {
          try { description = JSON.parse(`"${descMatch[1]}"`); } catch { /* ignore */ }
        }
      }
    }
  } catch (e) {
    console.log("Page fetch failed:", e);
  }

  // Step 3: If we have caption tracks, fetch the transcript
  if (captionTracks && captionTracks.length > 0) {
    console.log("Found", captionTracks.length, "caption tracks");
    const preferred =
      captionTracks.find((t: any) => t.languageCode?.startsWith("es")) ||
      captionTracks.find((t: any) => t.languageCode?.startsWith("en")) ||
      captionTracks[0];

    const captionUrl = preferred.baseUrl;
    if (captionUrl) {
      const captionRes = await fetch(captionUrl);
      if (captionRes.ok) {
        const captionXml = await captionRes.text();
        const lines: string[] = [];
        const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
        let match;
        while ((match = regex.exec(captionXml)) !== null) {
          const text = match[1]
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, " ").trim();
          if (text) lines.push(text);
        }
        if (lines.length > 0) {
          const lang = preferred.languageCode || "desconocido";
          return `# ${title}\n\n**Idioma de subtítulos:** ${lang}\n\n## Transcripción\n\n${lines.join(" ")}`;
        }
      }
    }
  }

  // Step 4: Fallback to description
  if (description) {
    return `# ${title}\n\n## Descripción del video\n\n${description}\n\n*Este video no tiene subtítulos disponibles. Se muestra la descripción.*`;
  }

  // Step 5: Last resort — return just title + link
  return `# ${title}\n\nVideo de YouTube: https://www.youtube.com/watch?v=${videoId}\n\n*No se pudieron extraer subtítulos ni descripción de este video.*`;

  // Prefer Spanish, then English, then first available
  const preferred =
    captionTracks.find((t: any) => t.languageCode?.startsWith("es")) ||
    captionTracks.find((t: any) => t.languageCode?.startsWith("en")) ||
    captionTracks[0];

  const captionUrl = preferred.baseUrl;
  if (!captionUrl) throw new Error("URL de subtítulos no disponible");

  console.log("Fetching captions from:", captionUrl);
  const captionRes = await fetch(captionUrl);
  if (!captionRes.ok) throw new Error(`Error al descargar subtítulos: ${captionRes.status}`);
  const captionXml = await captionRes.text();

  // Parse XML captions to plain text
  const lines: string[] = [];
  const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = regex.exec(captionXml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .trim();
    if (text) lines.push(text);
  }

  if (lines.length === 0) {
    // Captions XML was empty — fallback to description
    if (description) {
      return `# ${title}\n\n## Descripción del video\n\n${description}\n\n*Los subtítulos estaban vacíos. Se muestra la descripción.*`;
    }
    throw new Error("Subtítulos vacíos");
  }

  const lang = preferred.languageCode || "desconocido";
  return `# ${title}\n\n**Idioma de subtítulos:** ${lang}\n\n## Transcripción\n\n${lines.join(" ")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { input_id } = await req.json();
    if (!input_id) {
      return new Response(JSON.stringify({ error: "input_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: input, error: inputError } = await supabase
      .from("inputs")
      .select("id, original_url, type, title")
      .eq("id", input_id)
      .single();

    if (inputError || !input) {
      return new Response(JSON.stringify({ error: "Input not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!input.original_url) {
      return new Response(JSON.stringify({ error: "No URL to extract" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let formattedUrl = input.original_url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Check if it's a YouTube URL
    const videoId = extractYouTubeVideoId(formattedUrl);
    let extractedContent: string;

    if (videoId) {
      console.log("Extracting YouTube transcript for video:", videoId);
      extractedContent = await fetchYouTubeTranscript(videoId);
    } else {
      // Use Firecrawl for non-YouTube URLs
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (!firecrawlKey) {
        return new Response(JSON.stringify({ error: "Firecrawl not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Scraping URL:", formattedUrl);

      const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });

      if (!scrapeResponse.ok) {
        const errData = await scrapeResponse.json().catch(() => ({}));
        console.error("Firecrawl error:", scrapeResponse.status, errData);
        if (scrapeResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de extracción agotados" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ error: errData.error || "Error al extraer contenido de la URL" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const scrapeData = await scrapeResponse.json();
      extractedContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";

      if (!extractedContent) {
        return new Response(JSON.stringify({ error: "No se pudo extraer contenido de la URL" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Truncate to ~50k chars
    const truncated = extractedContent.length > 50000
      ? extractedContent.slice(0, 50000) + "\n\n[Contenido truncado]"
      : extractedContent;

    const { error: updateError } = await supabase
      .from("inputs")
      .update({ extracted_content: truncated })
      .eq("id", input_id);

    if (updateError) throw updateError;

    console.log("Extraction successful, length:", truncated.length);

    return new Response(
      JSON.stringify({ success: true, length: truncated.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-url error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});