import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { recentWalks } from './memory.js';
import { localGround } from './serpapi.js';
import { fetchWindow } from './window.js';

/* The mission agent's three senses: the weather brain (TabPFN), the ears on
   the ground (SerpApi), and long-term field memory (MongoDB / local). */

export const grassWindowTool = createTool({
  id: 'grass-window',
  description:
    'Ask the TabPFN Grass Window model for the best hours outdoors in a city over the coming days. Returns scores 0–100 and hour ranges.',
  inputSchema: z.object({
    cityKey: z.enum(['petaling-jaya', 'seattle', 'zurich']).describe('city to forecast'),
    days: z.number().min(1).max(7).default(5),
  }),
  outputSchema: z.object({
    source: z.string(),
    days: z.array(
      z.object({
        date: z.string(),
        weekday: z.string(),
        score: z.number(),
        hours: z.array(z.number()),
        tMax: z.number().optional(),
        precip: z.number().optional(),
      })
    ),
  }),
  execute: async ({ cityKey, days }) => {
    const w = await fetchWindow(cityKey, days);
    return {
      source: w?.source ?? 'unavailable',
      days: (w?.days ?? []).slice(0, days).map((d) => ({
        date: d.date,
        weekday: d.weekday,
        score: d.score,
        hours: d.hours,
        tMax: d.tMax,
        precip: d.precip,
      })),
    };
  },
});

export const localGroundTool = createTool({
  id: 'local-ground',
  description: 'Live web search (SerpApi) for what is happening outdoors right now near a city: seasons, blooms, foliage, events.',
  inputSchema: z.object({
    cityLabel: z.string().describe('e.g. "Petaling Jaya, MY"'),
    month: z.number().min(1).max(12),
    envs: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({ notes: z.array(z.string()) }),
  execute: async ({ cityLabel, month, envs }) => ({ notes: await localGround(cityLabel, month, envs) }),
});

export const fieldMemoryTool = createTool({
  id: 'field-memory',
  description: "This walker's recent missions and what a vision model saw on them. Avoid repeating recent missions.",
  inputSchema: z.object({
    cityKey: z.string(),
    limit: z.number().min(1).max(10).default(5),
  }),
  outputSchema: z.object({
    walks: z.array(z.object({ dateKey: z.string(), missionTitle: z.string(), seen: z.string().optional(), passed: z.boolean().optional() })),
  }),
  execute: async ({ cityKey, limit }) => {
    const walks = await recentWalks(cityKey, limit);
    return {
      walks: walks.map((w) => ({ dateKey: w.dateKey, missionTitle: w.missionTitle, seen: w.seen, passed: w.verdictPassed })),
    };
  },
});

export const fieldTools = { grassWindowTool, localGroundTool, fieldMemoryTool };
