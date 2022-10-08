import { Team } from '@prisma/client'
import { addSeconds, differenceInSeconds } from 'date-fns'
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

  const checkIsCaptain = async () => {
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
    const sortedTeams = teams.sort((a, b) => a.position - b.position)
    var mostVoted = sortedTeams[0]
    var mostVotedVotes = sortedTeams[0]._count.teamVoted

    for (var i = 0; i < teams.length; i++) {
      if (mostVotedVotes < teams[i]._count.teamVoted) {
        mostVoted = teams[i]
        mostVotedVotes = teams[i]._count.teamVoted
      }
    }
    return mostVoted.deviceId === payload.deviceId
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
    if (payload.deviceId !== payload.deviceIdToRemove) {
      const isCaptain = await checkIsCaptain()
      if (!isCaptain) {
        return true
      }
    }
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
    const isCaptain = await checkIsCaptain()
    if (!isCaptain) {
      return true
    }
    const timer = await prisma.field.update({
      where: { type: field },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    })
    console.log('timer: Pause:', timer)
    io.emit(field, { action: 'update-field', data: timer } as IResponse)
    return true
  }
  const handleTimerPlay = async () => {
    const isCaptain = await checkIsCaptain()
    if (!isCaptain) {
      return true
    }
    const time = await prisma.field.findFirst({
      where: { type: field },
    })
    let timeTimer
    if (time?.timer && time?.status === 'paused') {
      const distanceInSeconds = differenceInSeconds(
        new Date(),
        new Date(time?.pausedAt),
      )
      timeTimer = addSeconds(new Date(time.timer), distanceInSeconds)
    } else {
      timeTimer = new Date()
    }
    const timer = await prisma.field.update({
      where: { type: field },
      data: {
        status: 'played',
        timer: timeTimer,
      },
    })
    console.log('timer: play:', timer)
    io.emit(field, { action: 'update-field', data: timer } as IResponse)
    return true
  }
  const handleTimerReset = async () => {
    const isCaptain = await checkIsCaptain()
    if (!isCaptain) {
      return true
    }
    const timer = await prisma.field.update({
      where: { type: field },
      data: {
        status: 'initial',
        timer: new Date(),
      },
    })
    console.log('timer: reset:', timer)
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

  return handlers[payload.action]() || true
}
