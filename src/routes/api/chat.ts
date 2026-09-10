import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are ORCA (Marine EcOsystem Reasoning with Collaborative Agents), an agentic marine intelligence analyst.

You answer questions about ocean conditions, fishing activity, biodiversity and maritime boundaries by calling your tools and reasoning over the fused result.

Rules:
- Always call get_marine_conditions before making any claim about a specific place. Never invent numbers.
- If the user names a place instead of coordinates, infer approximate coordinates yourself and say which point you used.
- Every data block carries provenance. State clearly when a value is simulated/modelled rather than observed, and never present simulated data as measurement.
- Close each substantive answer with a short "Confidence" line (low/medium/high) plus the main limitation.
- Be concise and quantitative. Use markdown, short sections, and units.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { getMarineConditions, getSourceStatuses } = await import("@/lib/marine.server");

        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system: SYSTEM_PROMPT,
          messages: convertToModelMessages(body.messages as UIMessage[]),
          stopWhen: stepCountIs(50),
          abortSignal: request.signal,
          tools: {
            get_marine_conditions: tool({
              description:
                "Fused real-time marine conditions (ocean physics, weather, fishing effort, biodiversity, maritime boundaries) for a coordinate.",
              inputSchema: z.object({
                latitude: z.number().describe("Latitude in degrees, -90 to 90"),
                longitude: z.number().describe("Longitude in degrees, -180 to 180"),
                place_label: z.string().nullable().describe("Human readable name, or null"),
              }),
              execute: async ({ latitude, longitude, place_label }) => {
                const conditions = await getMarineConditions(latitude, longitude);
                return { place_label, ...conditions };
              },
            }),
            get_data_source_status: tool({
              description: "Live availability of every ORCA upstream data source.",
              inputSchema: z.object({
                reason: z.string().nullable().describe("Why the status is being checked, or null"),
              }),
              execute: async () => ({ data_sources: await getSourceStatuses() }),
            }),
          },
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          sendReasoning: true,
          originalMessages: body.messages as UIMessage[],
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
