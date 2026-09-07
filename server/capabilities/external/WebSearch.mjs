import https from "node:https";

function request(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8"
                },
                timeout: 20000
            },
            res => {
                let data = "";

                res.setEncoding("utf8");

                res.on("data", chunk => {
                    data += chunk;
                });

                res.on("end", () => {
                    resolve({
                        status: res.statusCode,
                        body: data
                    });
                });
            }
        );

        req.on("timeout", () => {
            req.destroy(new Error("Web request timeout"));
        });

        req.on("error", reject);
    });
}

function decodeDuckUrl(value) {
    try {
        const absolute = value.startsWith("//")
            ? `https:${value}`
            : value;

        const u = new URL(absolute);

        const target = u.searchParams.get("uddg");

        if (target) {
            return decodeURIComponent(target);
        }

        return absolute;
    } catch {
        return value;
    }
}

export const WebSearch = {
    name: "web.search",

    description:
        "Search the public internet and return real search results.",

    async execute({ query, max_results = 5 }) {
        if (!query || typeof query !== "string") {
            throw new Error("query is required");
        }

        const url =
            "https://html.duckduckgo.com/html/?q=" +
            encodeURIComponent(query);

        const response = await request(url);

        if (response.status < 200 || response.status >= 300) {
            throw new Error(
                `Search engine returned HTTP ${response.status}`
            );
        }

        const html = response.body;

        const results = [];

        const regex =
            /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

        let match;

        while (
            (match = regex.exec(html)) !== null &&
            results.length < max_results
        ) {
            const rawUrl = match[1];

            const title = match[2]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&#x27;/g, "'")
                .replace(/&quot;/g, '"')
                .trim();

            const url = decodeDuckUrl(rawUrl);

            if (
                title &&
                /^https?:\/\//i.test(url)
            ) {
                results.push({
                    title,
                    url
                });
            }
        }

        return {
            success: true,
            query,
            engine: "DuckDuckGo",
            resultCount: results.length,
            results
        };
    }
};
