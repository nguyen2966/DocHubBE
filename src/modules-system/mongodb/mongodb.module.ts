import { Global, Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { MONGO_URL } from 'src/common/constants/app.constants';
import { User, UserSchema } from './schemas/users.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(MONGO_URL as string),
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema
      }
    ])
  ],
  exports: [MongooseModule],
})
export class MongoDbModule implements OnModuleInit {
  constructor(@InjectConnection() private connection : Connection){}

  async onModuleInit(){
    try{
      console.log(`[LOG] MongoDB connection state: ${this.connection.readyState? "OK" : "Failed"} `);
    } catch(err){
      console.log(err);
    }
  }
}