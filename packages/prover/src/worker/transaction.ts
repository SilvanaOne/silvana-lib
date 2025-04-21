import { JobMetadata } from "./metadata.js";

/**
 * Human-readable transaction metadata
 * jobMetadata: the job metadata
 * events: the events
 * actions: the actions
 * custom: the custom metadata defined by the developer
 */

export interface TransactionMetadata {
  jobMetadata?: JobMetadata;
  events?: object[];
  actions?: object[];
  custom?: object;
}
