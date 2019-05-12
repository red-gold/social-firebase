import { VerifyType } from '../../domain/authentication/verifyType'

export class VerificationSavedModel {
    constructor(
        public userId: string,
        public code: number,
        public target: string,
        public counter: number,
        public targetType: VerifyType,
        public remoteIpAddress: string,

    ) {
        
    }
}