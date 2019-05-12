import { TokenType } from '../../domain/authentication/tokenType'

export class PhoneVerficationTokeModel {
    constructor(
       public user: any, 
       public code: number, 
       public remoteIpAddress: string,
       public counter: number, 
       public tokenType: TokenType, 
       public tokenPayload: object
    ) {
        
    }
}