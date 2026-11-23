import type {
  SqlJsonClient,
} from "../db/PsqlJsonClient.ts";

import {
  sqlLiteral,
} from "../db/PsqlJsonClient.ts";


export type CompanyContextActivation = {
  activationEventId:number;
  contextId:number;
  contextKey:string;
  effectiveStandardReleaseId:number;
  status:"active";
  activatedBy:string;
  activatedAt:string;
};


export class CompanyContextActivationRepository {
  constructor(
    private readonly client:SqlJsonClient
  ) {}


  async activate(input:{
    contextKey:string;
    effectiveStandardReleaseId:number;
    rationale:string;
    actor:string;
  }):Promise<CompanyContextActivation> {
    const rows=
      await this.client.query<any>(`
        SELECT *
        FROM rdl.activate_company_context(
          ${sqlLiteral(input.contextKey)},
          ${Number(
            input.effectiveStandardReleaseId
          )},
          ${sqlLiteral(input.rationale)},
          ${sqlLiteral(input.actor)}
        )
      `);

    const row=rows[0];

    if(!row)
      throw new Error(
        "Company context activation returned no result."
      );

    return {
      activationEventId:
        Number(row.activation_event_id),

      contextId:
        Number(row.context_id),

      contextKey:
        String(row.context_key),

      effectiveStandardReleaseId:
        Number(
          row.effective_standard_release_id
        ),

      status:"active",

      activatedBy:
        String(row.activated_by),

      activatedAt:
        String(row.activated_at),
    };
  }
}
