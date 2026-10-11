import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TASK_QUEUE } from '../lib/temporal.js';
import * as activities from './activities.js';

const address = process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233';
const self = import.meta.url;
const workflowsPath = fileURLToPath(new URL(self.endsWith('.ts') ? './workflows.ts' : './workflows.js', self));

const connection = await NativeConnection.connect({ address });
const worker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: TASK_QUEUE,
  workflowsPath,
  activities,
});

console.log(`[temporal] worker listening · ${address} · queue ${TASK_QUEUE}`);
await worker.run();
