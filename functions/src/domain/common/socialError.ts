import { HttpStatusCode } from '../../data/httpStatusCode'

export class SocialError {
  public isError: Boolean

  constructor (public code: string, public message: string, status: HttpStatusCode = HttpStatusCode.Forbidden) {
    this.isError = true
  }
}
