import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { importGmailAlerts } from "../src/lib/gmail";

const prisma=new PrismaClient(); const owner=`worker-${crypto.randomUUID()}`; let running=false;
async function acquire(){const now=new Date(),until=new Date(Date.now()+4*60_000);try{await prisma.schedulerLock.create({data:{name:"scheduled-tasks",owner,lockedUntil:until}});return true}catch{const result=await prisma.schedulerLock.updateMany({where:{name:"scheduled-tasks",lockedUntil:{lt:now}},data:{owner,lockedUntil:until}});return result.count===1}}
async function run(){if(running||!await acquire())return;running=true;const execution=await prisma.execution.create({data:{task:"scheduled-sync",status:"running"}});try{const integration=await prisma.integration.findUnique({where:{provider:"gmail"}});const processed=integration?.status==="connected"&&integration.selectedFolder?await importGmailAlerts():0;await prisma.execution.update({where:{id:execution.id},data:{status:"success",processed,finishedAt:new Date()}})}catch(error){await prisma.execution.update({where:{id:execution.id},data:{status:"failed",finishedAt:new Date(),errorMessage:(error instanceof Error?error.message:"Erro desconhecido").slice(0,500)}})}finally{await prisma.schedulerLock.deleteMany({where:{name:"scheduled-tasks",owner}});running=false}}
const interval=Math.max(60_000,Number(process.env.WORKER_INTERVAL_MS)||300_000);void run();setInterval(()=>void run(),interval);
for(const signal of ["SIGINT","SIGTERM"]){process.on(signal,async()=>{await prisma.$disconnect();process.exit(0)})}
