const TEST_GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyZf5YYKH6x60cYNXEI1Xsrd0JAyscB0r0fDMItspvJYOqUG6Hu2Thg9e86MzkR2VwFTQ/exec";

export default async function handler(req, res) {

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );

    try {

        // ==================================================
        // GET
        // ==================================================

        if (req.method === "GET") {

            // Bước 1: KHÔNG tự redirect
            const first = await fetch(
                TEST_GOOGLE_SCRIPT_URL,
                {
                    method: "GET",

                    redirect: "manual",

                    headers: {
                        "User-Agent":
                            "Mozilla/5.0",

                        "Accept":
                            "application/json,text/plain,*/*",

                        "Cache-Control":
                            "no-cache"
                    }
                }
            );


            const location =
                first.headers.get("location");


            // Nếu Google trả thẳng JSON
            if (first.ok) {

                const text =
                    await first.text();

                res.setHeader(
                    "Content-Type",
                    "application/json; charset=utf-8"
                );

                return res.status(200).send(text);
            }


            // ==================================================
            // GOOGLE REDIRECT
            // ==================================================

            if (
                (
                    first.status === 301 ||
                    first.status === 302 ||
                    first.status === 303 ||
                    first.status === 307 ||
                    first.status === 308
                )
                &&
                location
            ) {

                const second =
                    await fetch(
                        location,
                        {
                            method: "GET",

                            redirect: "follow",

                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0",

                                "Accept":
                                    "application/json,text/plain,*/*",

                                "Cache-Control":
                                    "no-cache"
                            }
                        }
                    );


                const text =
                    await second.text();


                if (!second.ok) {

                    return res
                        .status(502)
                        .json({

                            status: "ERROR",

                            stage:
                                "AFTER_REDIRECT",

                            firstStatus:
                                first.status,

                            redirectHost:
                                new URL(location).hostname,

                            secondStatus:
                                second.status,

                            finalUrl:
                                second.url,

                            bodyStart:
                                text.substring(
                                    0,
                                    300
                                )
                        });
                }


                res.setHeader(
                    "Content-Type",
                    "application/json; charset=utf-8"
                );


                return res
                    .status(200)
                    .send(text);
            }


            // ==================================================
            // GOOGLE KHÔNG REDIRECT
            // ==================================================

            const firstText =
                await first.text();


            return res
                .status(502)
                .json({

                    status:
                        "ERROR",

                    stage:
                        "FIRST_REQUEST",

                    firstStatus:
                        first.status,

                    location:
                        location || "",

                    bodyStart:
                        firstText.substring(
                            0,
                            300
                        )
                });
        }


        // ==================================================
        // POST - GIỮ NGUYÊN CƠ CHẾ CŨ TẠM THỜI
        // ==================================================

        if (req.method === "POST") {

            let body;


            if (
                typeof req.body ===
                "string"
            ) {

                body =
                    req.body;

            } else {

                body =
                    JSON.stringify(
                        req.body || {}
                    );
            }


            const response =
                await fetch(
                    TEST_GOOGLE_SCRIPT_URL,
                    {
                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "text/plain;charset=utf-8",

                            "User-Agent":
                                "Mozilla/5.0"
                        },

                        body:
                            body,

                        redirect:
                            "follow"
                    }
                );


            const text =
                await response.text();


            if (!response.ok) {

                return res
                    .status(502)
                    .json({

                        status:
                            "ERROR",

                        message:
                            "Google Apps Script POST lỗi: " +
                            response.status,

                        finalUrl:
                            response.url,

                        bodyStart:
                            text.substring(
                                0,
                                300
                            )
                    });
            }


            res.setHeader(
                "Content-Type",
                "application/json; charset=utf-8"
            );


            return res
                .status(200)
                .send(text);
        }


        res.setHeader(
            "Allow",
            "GET, POST"
        );


        return res
            .status(405)
            .json({
                status:
                    "ERROR"
            });


    } catch (error) {

        return res
            .status(500)
            .json({

                status:
                    "ERROR",

                stage:
                    "PROXY_EXCEPTION",

                message:
                    error &&
                    error.message
                        ? error.message
                        : String(error)
            });
    }
}
