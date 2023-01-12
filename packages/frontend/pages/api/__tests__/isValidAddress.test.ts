/**
 * @jest-environment node
 */
 import { createMocks, RequestMethod, createRequest, createResponse } from 'node-mocks-http';
 import type { NextApiResponse } from 'next';
 import requestHandler from '../../../pages/api/isValidAddress';
 import axios from 'axios';
 
 jest.mock("axios");
 const mockedAxios = axios as jest.Mocked<typeof axios>;

 type APIRequest = NextApiResponse & ReturnType<typeof createRequest>;
 type APIResponse = NextApiResponse & ReturnType<typeof createResponse>;

 export interface isValidAddressResponse {
    valid: boolean,
    madeThirdPartyConnection: boolean
  }

 describe('/api/isValidAddress/[address] API Endpoint', () => {

   const safeAddress = '0xa3cb04d8bd927eec8826bd77b7c71abe3d29c081'
   const highRiskAddress = '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'
   const invalidAddress = 'jksd'
   
   function mockRequestResponse(method: RequestMethod = 'GET', address: string) {
     const {
       req,
       res,
     }: { req: APIRequest; res: APIResponse } = createMocks({ method });
     req.query = { address: address };
     return { req, res };
   }

   it('should return TRUE for a safe address supplied', async () => {
    const { req, res } = mockRequestResponse('GET',safeAddress);

    mockedAxios.post.mockResolvedValue({
        data: [
            {
                "asset": "ETH",
                "address": "0xa3cb04d8bd927eec8826bd77b7c71abe3d29c081",
                "cluster": null,
                "rating": "unknown",
                "customAddress": null,
                "chainalysisIdentification": null
            }
        ],
      });

    await requestHandler(req, res);

    const responseData = res._getJSONData() as isValidAddressResponse

    expect(responseData.valid).toEqual(true);
    expect(responseData.madeThirdPartyConnection).toEqual(true);
   });

   it('should return FALSE for a risky address supplied', async () => {
     const { req, res } = mockRequestResponse('GET',highRiskAddress);

     mockedAxios.post.mockResolvedValue({
        data: [
            {
                "asset": "ETH",
                "address": "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
                "cluster": {
                    "name": "OFAC SDN Lazarus Group 2022-04-14",
                    "category": "sanctions"
                },
                "rating": "highRisk",
                "customAddress": null,
                "chainalysisIdentification": {
                    "addressName": "Some info",
                    "description": "Some info",
                    "categoryName": "Some info"
                }
            }
        ],
      });
     
     await requestHandler(req, res);
 
     const responseData = res._getJSONData() as isValidAddressResponse
     expect(responseData.valid).toEqual(false);
     expect(responseData.madeThirdPartyConnection).toEqual(true);
   });

   it('should return TRUE if response body does not match what we expect', async () => {
    const { req, res } = mockRequestResponse('GET',highRiskAddress);

    mockedAxios.post.mockResolvedValue({
       data: null,
     });
    
    await requestHandler(req, res);

    const responseData = res._getJSONData() as isValidAddressResponse
    expect(responseData.valid).toEqual(true);
    expect(responseData.madeThirdPartyConnection).toEqual(true);
  });


   it('should return TRUE for all errors encountered when querying third-party service', async () => {

    const { req, res } = mockRequestResponse('GET',invalidAddress);
   
    mockedAxios.post.mockRejectedValue(new Error('💣'))
    
    await requestHandler(req, res);

    const responseData = res._getJSONData() as isValidAddressResponse
    expect(responseData.valid).toEqual(true);
    expect(responseData.madeThirdPartyConnection).toEqual(false);
  });

 });