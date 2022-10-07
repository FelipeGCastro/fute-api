import { prisma } from '../database/prisma'
import { io, IPayload, IResponse } from '../server'
export type FieldsType = 'fieldA' | 'fieldB' | 'fieldC' | 'fieldD' | 'fieldE'
export const payloadHandler = (field: FieldsType, payload: IPayload) => {
  const sendTeams = async () => {
    const teams = await prisma.team.findMany({
      where: { fieldType: field },
      include: {
        // teamVoting: { select: { teamVoting: { select: { deviceId: true } } } },
        teamVoting: { select: { teamVotedDeviceId: true } },
        _count: {
          select: { teamVoted: true },
        },
      },
    })

    io.emit(field, { action: 'update-teams', data: teams } as IResponse)
    return true
  }

  const sendVotes = async () => {
    const votes = await prisma.vote.findMany({
      where: { fieldType: field },
    })
    io.emit(field, { action: 'update-votes', data: votes } as IResponse)
  }

  const handleVote = async () => {
    const vote = await prisma.vote.upsert({
      where: { teamVotingDeviceId: payload.deviceId },
      update: { teamVotedDeviceId: payload.votedDeviceId },
      create: {
        teamVotingDeviceId: payload.deviceId,
        teamVotedDeviceId: payload.votedDeviceId,
        fieldType: field,
      },
    })
    console.log('Vote:', vote)
    await sendTeams()
    return true
  }

  const handleAddNextTeam = async () => {
    const teams = await prisma.team.findMany({
      where: { fieldType: field },
    })
    const team = await prisma.team.upsert({
      where: { deviceId: payload.deviceId },
      update: {},
      create: {
        name: payload.teamName,
        deviceId: payload.deviceId,
        position: teams.length + 1,
        fieldType: field,
      },
    })
    console.log('Team:', team)
    await sendTeams()
    return true
  }

  const handleRemoveTeam = async () => {
    const team = await prisma.team.delete({
      where: { deviceId: payload.deviceId },
    })
    await prisma.vote.deleteMany({
      where: { teamVotingDeviceId: payload.deviceId },
    })
    console.log('Team:', team)
    await sendTeams()
    return true
  }

  if (payload.action === 'add-team') {
    return handleAddNextTeam()
  } else if (payload.action === 'remove-team') {
    return handleRemoveTeam()
  } else if (payload.action === 'vote-captain') {
    return handleVote()
  } else if (payload.action === 'fetch-teams') {
    return sendTeams()
  }
}

// const team = {
//   deviceId: '0',
//   name: 'luiz castro',
//   position: 1,
//   votes: ['deviceId'],
//   field: 'A',
// }
// const votes = {
//   fieldId: 'DSFASFAS',
//   teamId: 'DSFASFAS',
// }
// const field = {
//   type: 'A',
//   timer: {
//     timer: 556165165, //1:0 556165165 - ('pausedAt' - 'initialTime')
//     pausedAt: 61651651561, // 1:5
//     action: 'paused' || 'initial' || 'played', // 1:7
//   },
// }
