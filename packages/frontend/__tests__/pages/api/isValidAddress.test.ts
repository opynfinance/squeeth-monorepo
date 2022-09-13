/**
 * @jest-environment node
 */
 import { createMocks, RequestMethod, createResponse } from 'node-mocks-http';
 import type { NextApiRequest, NextApiResponse } from 'next';
 import requestHandler from '../../../pages/api/isValidAddress';

 type APiResponse = NextApiResponse & ReturnType<typeof createResponse>;

 export interface isValidAddressResponse {
    valid: boolean,
    madeThirdPartyConnection: boolean
  }

 describe('/api/isValidAddress/[address] API Endpoint', () => {

   const safeAddress = '0xa3cb04d8bd927eec8826bd77b7c71abe3d29c081'
   const highRiskAddress = '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'
   const invalidAddress = 'jksd'
   
   function makeRequestResponse(method: RequestMethod = 'GET', address: string) {
     const {
       req,
       res,
     }: { req: NextApiRequest; res: APiResponse } = createMocks({ method });
     req.query = { address: address };
     return { req, res };
   }

   it('should return TRUE for a safe address supplied', async () => {
    const { req, res } = makeRequestResponse('GET',safeAddress);

    await requestHandler(req, res);

    const responseData = res._getJSONData() as isValidAddressResponse
    expect(responseData.valid).toEqual(true);
    expect(responseData.madeThirdPartyConnection).toEqual(true);
   });

   it('should return FALSE for a risky address supplied', async () => {
     const { req, res } = makeRequestResponse('GET',highRiskAddress);
     
     await requestHandler(req, res);
 
     const responseData = res._getJSONData() as isValidAddressResponse
     expect(responseData.valid).toEqual(false);
     expect(responseData.madeThirdPartyConnection).toEqual(true);
   });


   it('should return TRUE for all errors encountered when querying third-party service', async () => {

    const { req, res } = makeRequestResponse('GET',invalidAddress);
    
    await requestHandler(req, res);

    const responseData = res._getJSONData() as isValidAddressResponse
    expect(responseData.valid).toEqual(true);
    expect(responseData.madeThirdPartyConnection).toEqual(false);
  });

 });