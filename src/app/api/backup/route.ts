import { prisma } from "@/lib/db";
import { exportBackup } from "@/lib/backup";
export async function GET(){const backup=await exportBackup(prisma);return new Response(JSON.stringify(backup,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="job-search-backup-${new Date().toISOString().slice(0,10)}.json"`,"cache-control":"no-store"}})}
