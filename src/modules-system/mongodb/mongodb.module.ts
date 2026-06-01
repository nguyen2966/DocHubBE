import { Global, Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { MONGO_URL } from 'src/common/constants/app.constants';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(MONGO_URL as string, {
      onConnectionCreate: (connection) => {
        console.log('[LOG] MongoDB Connected');
        return connection;
      },
    }),
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