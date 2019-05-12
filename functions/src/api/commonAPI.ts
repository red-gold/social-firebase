import * as moment from 'moment/moment'

/**
 * Check if the moment is expired returen true else return false
 * @param time is created moment
 * @param expireTime is the number of minutes the moment will be expired
 */
const checkMomentExpire = (time: number, expireTime: number) => {
    const exp = moment(time)
    const now = moment.utc()
    return (now.diff(exp, 'minutes') > expireTime)
}

export const commonAPI = {
    checkMomentExpire
}