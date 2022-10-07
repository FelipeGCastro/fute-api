import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const fieldA = await prisma.field.upsert({
    where: { type: 'fieldA' },
    update: {},
    create: {
      type: 'fieldA',
      timer: new Date(),
      pausedAt: new Date(),
      status: 'initial',
    },
  })
  const fieldB = await prisma.field.upsert({
    where: { type: 'fieldB' },
    update: {},
    create: {
      type: 'fieldB',
      timer: new Date(),
      pausedAt: new Date(),
      status: 'initial',
    },
  })
  const fieldC = await prisma.field.upsert({
    where: { type: 'fieldC' },
    update: {},
    create: {
      type: 'fieldC',
      timer: new Date(),
      pausedAt: new Date(),
      status: 'initial',
    },
  })
  const fieldD = await prisma.field.upsert({
    where: { type: 'fieldD' },
    update: {},
    create: {
      type: 'fieldD',
      timer: new Date(),
      pausedAt: new Date(),
      status: 'initial',
    },
  })
  const fieldE = await prisma.field.upsert({
    where: { type: 'fieldE' },
    update: {},
    create: {
      type: 'fieldE',
      timer: new Date(),
      pausedAt: new Date(),
      status: 'initial',
    },
  })

  console.log({ fieldA, fieldB, fieldC, fieldD, fieldE })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
