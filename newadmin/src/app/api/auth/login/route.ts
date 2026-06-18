import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Forward request to kuberexchange.com
        const backendRes = await fetch("https://zeero.bet/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await backendRes.json();

        if (!backendRes.ok) {
            return NextResponse.json(
                { message: data.message || "Backend login failed" },
                { status: backendRes.status }
            );
        }

        return NextResponse.json(data, { status: 200 });

    } catch (error) {
        console.error("Login Proxy Error:", error);
        return NextResponse.json(
            { message: "Internal Server Error during login proxy" },
            { status: 500 }
        );
    }
}
