import { Team } from '@prisma/client'
import { addSeconds, differenceInSeconds } from 'date-fns'
import { prisma } from '../database/prisma'
import { IErrorCodes, io, IPayload, IResponse } from '../server'
export type FieldsType = 'fieldA' | 'fieldB' | 'fieldC' | 'fieldD' | 'fieldE'
export const payloadHandler = async (field: FieldsType, payload: IPayload) => {
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
    if (teams.length) {
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
    } else {
      return false
    }
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
    if (
      payload.deviceIdToAddNext &&
      payload.deviceIdToAddNext !== payload.deviceId
    ) {
      const isCaptain = await checkIsCaptain()
      if (!isCaptain) {
        return false
      }
    }

    const teams = await prisma.team.findMany({
      where: { fieldType: field },
    })
    let lastPosition
    if (teams.length) {
      const sortedTeams = teams.sort((a, b) => a.position - b.position)
      lastPosition = sortedTeams[0].position

      for (var i = 0; i < teams.length; i++) {
        if (lastPosition < teams[i].position) {
          lastPosition = teams[i].position
        }
      }
      lastPosition = lastPosition + 1
    } else {
      lastPosition = teams.length + 1
    }
    const deviceId = payload.deviceIdToAddNext || payload.deviceId
    const team = await prisma.team.upsert({
      where: { deviceId: deviceId },
      update: {
        position: lastPosition,
      },
      create: {
        name: payload.teamName,
        deviceId: payload.deviceId,
        position: lastPosition,
        fieldType: field,
      },
    })
    console.log('Next Team:', team)
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
    let team
    try {
      team = await prisma.team.delete({
        where: { deviceId: payload.deviceId },
      })
    } catch (error) {
      console.log('error:', error)
    }

    await prisma.vote.deleteMany({
      where: { teamVotingDeviceId: payload.deviceId },
    })
    console.log('Team Removed:', team)
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

  const fieldVerification = async () => {
    if (!payload.deviceId && payload.action !== 'fetch-teams') {
      return false
    }
    const team = await prisma.team.findFirst({
      where: { deviceId: payload.deviceId },
    })
    if (team && team.fieldType !== field) {
      if (
        payload.action === 'remove-team' ||
        payload.action === 'fetch-teams'
      ) {
        return true
      } else {
        io.emit('error', { code: 'otherField' } as IErrorCodes)
        return false
      }
    }
    return true
  }
  const verification = await fieldVerification()
  if (!verification) {
    return false
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
