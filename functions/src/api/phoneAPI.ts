import * as functions from 'firebase-functions'
const plivo = require('plivo')

/**
 * Send phone message
 */
const sendMessage = async (sourceNumber: string, targetNumber: string, message: string) => {

  try {
    const client = new plivo.Client(functions.config().plivo.authid, functions.config().plivo.authtoken)
    const smsResult = await client.messages.create(sourceNumber, targetNumber, message)
    return smsResult

  } catch (error) {

    console.error('There was an error while sending the email:', error)
  }

}

export const phoneAPI = {
    sendMessage
}