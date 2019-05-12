export class RegisterUserModel {
    constructor(
       public userId: string,
       public fullName: string,
       public avatar: string,
       public email: string,
       public password: string,
       public remoteIpAddress: string,
       public phoneVerifide?: boolean,
       public emailVerifide?: boolean,
       public phone?: string
    ) {}
}