import https from "node:https";
import http from "node:http";

function request(url) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);

        const client =
            target.protocol === "https:"
                ? https
                : http;

        const req = client.get(
            target,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
                },
                timeout: 20000
            },
            res => {
                let data = "";

                res.setEncoding("utf8");

                res.on("data", chunk => {
                    data += chunk;

                    if (data.length > 2_000_000) {
                        req.destroy(
                            new Error("Web page exceeds 2MB limit")
                        );
                    }
                });

                res.on("end", () => {
                    resolve({
                        status: res.statusCode,
                        contentType: res.headers["content-type"] || "",
                        body: data
                    });
                });
            }
        );

        req.on("timeout", () => {
            req.destroy(new Error("Web open timeout"));
        });

        req.on("error", reject);
    });
}

export const WebOpen = {
    name: "web.open",

    description:
        "Open and retrieve the contents of a public HTTP or HTTPS web page.",

    async execute({ url }) {
        if (!url || typeof url !== "string") {
            throw new Error("url is required");
        }

        if (!/^https?:\/\//i.test(url)) {
            throw new Error("Only HTTP and HTTPS URLs are allowed");
        }

        const response = await request(url);

        if (
            response.status < 200 ||
            response.status >= 400
        ) {
            throw new Error(
                `Web page returned HTTP ${response.status}`
            );
        }

        return {
            success: true,
            url,
            status: response.status,
            contentType: response.contentType,
            content: response.body
        };
    }
};
