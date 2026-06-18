import { NextResponse } from "next/server";
import connectMongo from "@/lib/mongo";
import { CasinoGame } from "@/models/MongoModels";

export async function GET() {
    try {
        await connectMongo();
        const res = await CasinoGame.findOneAndUpdate(
            { gameCode: "9314c96955df74bbf04083a57947b0c7" },
            { icon: "9GAME/Rock Paper Scissors.png" }
        );
        return NextResponse.json({ success: true, res });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
