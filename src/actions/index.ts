import { formatDistanceStrict, isAfter } from 'date-fns'
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

  const handleTimerPause = async () => {
    const timer = await prisma.field.update({
      where: { type: field },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    })
    io.emit(field, { action: 'update-field', data: timer } as IResponse)
    return true
  }
  const handleTimerPlay = async () => {
    const time = await prisma.field.findFirst({
      where: { type: field },
    })
    let timeTimer
    if (time?.timer && time?.status === 'paused') {
      // timeTimer = formatDistanceStrict(time?.pausedAt)
    }
    const timer = await prisma.field.update({
      where: { type: field },
      data: {
        status: 'played',
        timer: timeTimer,
      },
    })
    io.emit(field, { action: 'update-field', data: timer } as IResponse)
    return true
  }
  const handleTimerReset = async () => {
    const timer = await prisma.field.update({
      where: { type: field },
      data: {
        status: 'initial',
        timer: new Date(),
      },
    })
    io.emit(field, { action: 'update-field', data: timer } as IResponse)
    return true
  }

  const handlers = {
    ['add-team']: handleAddNextTeam,
    ['remove-team']: handleRemoveTeam,
    ['vote-captain']: handleVote,
    ['fetch-teams']: sendTeams,
    ['timer-pause']: handleTimerPause,
    ['timer-play']: handleTimerPlay,
    ['timer-reset']: handleTimerReset,
  }

  return handlers[payload.action] || true
}
