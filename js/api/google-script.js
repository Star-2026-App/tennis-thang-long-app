const TEST_GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyZf5YYKH6x60cYNXEI1Xsrd0JAyscB0r0fDMItspvJYOqUG6Hu2Thg9e86MzkR2VwFTQ/exec";

export default async function handler(req, res) {

    // Không cache dữ liệu CLB
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    try {

        // ==================================================
        // GET - LOAD TOÀN BỘ DỮ LIỆU
        // ==================================================

        if (req.method === "GET") {

            const response = await fetch(
                TEST_GOOGLE_SCRIPT_URL,
                {
                    method: "GET",
                    redirect: "follow"
                }
            );

            const text = await response.text();

            if (!response.ok) {
                return res.status(502).json({
                    status: "ERROR",
                    message: "Google Apps Script GET lỗi: " + response.status
                });
            }

            res.setHeader(
                "Content-Type",
                "application/json; charset=utf-8"
            );

            return res.status(200).send(text);
        }


        // ==================================================
        // POST - GHI / SỬA / XÓA
        // ==================================================

        if (req.method === "POST") {

            let body;

            if (typeof req.body === "string") {

                body = req.body;

            } else if (Buffer.isBuffer(req.body)) {

                body = req.body.toString("utf8");

            } else {

                body = JSON.stringify(req.body || {});
            }


            const response = await fetch(
                TEST_GOOGLE_SCRIPT_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "text/plain;charset=utf-8"
                    },

                    body: body,

                    redirect: "follow"
                }
            );


            const text = await response.text();


            if (!response.ok) {

                return res.status(502).json({
                    status: "ERROR",
                    message: "Google Apps Script POST lỗi: " + response.status
                });
            }


            res.setHeader(
                "Content-Type",
                "application/json; charset=utf-8"
            );


            return res.status(200).send(text);
        }


        // ==================================================
        // METHOD KHÁC
        // ==================================================

        res.setHeader(
            "Allow",
            "GET, POST"
        );


        return res.status(405).json({
            status: "ERROR",
            message: "Method không được hỗ trợ."
        });


    } catch (error) {

        console.error(
            "GOOGLE SCRIPT PROXY ERROR:",
            error
        );


        return res.status(500).json({
            status: "ERROR",
            message:
                error && error.message
                    ? error.message
                    : String(error)
        });
    }
}
