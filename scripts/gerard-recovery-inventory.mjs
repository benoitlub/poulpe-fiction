#!/usr/bin/env node
// Gerard's read-only recovery queue: review existing work before generating duplicates.
import {readFile} from "node:fs/promises";
const file=new URL("../garden/gerard-recovery-inventory.json",import.meta.url);
const data=JSON.parse(await readFile(file,"utf8"));
const counts={};
for(const item of data.items??[])counts[item.status]=(counts[item.status]??0)+1;
const report={contract:data.contract,updatedAt:data.updatedAt,total:(data.items??[]).length,byStatus:counts,
 reviewQueue:(data.items??[]).map(({id,project,status,blockers,nextAction,preferredProvider,source})=>({id,project,status,blockers,nextAction,preferredProvider,source})),
 safety:data.rules,notice:"Read-only snapshot. Confirm current provider state, media, quality and rights before scheduling. Never modify already scheduled posts."};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
