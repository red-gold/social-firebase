import { VerifyType } from './verifyType'

export class Verification {
    constructor(
        public id: string,
        public code: string,
        public target: string,
        public targetType: VerifyType,
        public counter: number,
        public creationDate: number,
        public remoteIpAddress: string,
        public userId: string,
        public isVerified: boolean = false
    ) {}
}