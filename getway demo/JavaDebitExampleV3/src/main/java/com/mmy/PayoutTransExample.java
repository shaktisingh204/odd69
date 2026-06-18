package com.mmy;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.mmy.model.RequestData;
import com.mmy.model.ResponseData;
import com.mmy.utils.AesUtil;
import com.mmy.utils.HttpUtil;
import com.mmy.utils.Md5Util;
import com.mmy.utils.SdfFactory;

import java.math.BigDecimal;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Do payout transaction Example
 */
public class PayoutTransExample {
    private static final String BASE_URL = "https://phpay.ipayment.vip/dgateway";
//    private static final String BASE_URL = "http://localhost:8080/debitpay";

    private static final String URL_TRANSFER_APPLY = BASE_URL + "/ws/trans/nocard/transferApply";
    private static final String URL_TRANSFER_QUERY = BASE_URL + "/ws/trans/nocard/transferQuery";

    private static final String MCH_NO = "A0001";
    private static final String ENC_KEY = "1234567812345678";
    private static final String SIGN_KEY = "1234";

    public static void main(String[] args) throws Exception {
        // [1]. Payout Apply
        // doTransferApply();

        // [2]. Payout Query
        // doTransferQuery("D1721983755801");

        // [3]. Payout Webhook
        payoutWebhook();
    }

    public static void doTransferApply() throws Exception {
        Map<String, String> payloadMap = new HashMap<>();
        // versionNo, Interface Version, Required, Fixed value of 1 2
        payloadMap.put("versionNo", "1");
        // mchNo, Merchant Number, Required, Assigned by the platform  16
        payloadMap.put("mchNo", MCH_NO);
        // price, Payment Amount, Required, Unit: INR, precise to 1, must be greater than 1, INR
        payloadMap.put("price", new BigDecimal("1000").toString());
        // orderDate Order Date Required Format: yyyyMMddHHmmss (e.g., 20161021185120) 16
        payloadMap.put("orderDate", SdfFactory.DATETIME.format(new Date()));
        // tradeNo Merchant Transaction Number Required Internal transaction number, ensure uniqueness 32
        payloadMap.put("tradeNo", "D" + System.currentTimeMillis());
        // notifyUrl Asynchronous Notification URL Required URL for notification of success or failure 200
        payloadMap.put("notifyUrl", "https://www.sample.com");
        // mode Payment Type Required S1 - Settlement Account；S0- Real-time Account (for real-time settlement) 2
        payloadMap.put("mode", "S1");

        // IFSC Code, Required, Recipient's IFSC code
        payloadMap.put("accBankCode", "IFSC-Sample-Code");
        // Recipient’s Card No, Required, Recipient's bank account no.
        payloadMap.put("accCardNo", "123456789");

        // Recipient’s Name, Optional, Recipient's Legal Name
        payloadMap.put("accName", "Jack");
        // Recipient’s Phone, Optional, Recipient's Phone number
        payloadMap.put("accTel", "66123456789");
        // Recipient’s Email, Optional, Recipient's Email Address
        payloadMap.put("accEmail", "tom@example.com");
        
        // purpose, Purpose, Required, Purpose of the payment, 50
        payloadMap.put("purpose", "settlement for merchant");

        String plainPayload = JSON.toJSONString(payloadMap);
        System.out.println("Request Plain Payload => " + plainPayload);

        String encryptPayload = AesUtil.encrypt(plainPayload, ENC_KEY);
        System.out.println("Request Encrypt Payload => " + encryptPayload);

        String signedValue = Md5Util.MD5Encode(encryptPayload + SIGN_KEY, "UTF-8").toUpperCase();
        System.out.println("Request Signed Value => " + signedValue);

        RequestData req = new RequestData();
        req.setMchNo(MCH_NO);
        req.setPayload(encryptPayload);
        req.setSign(signedValue);

        String requestString = JSON.toJSONString(req);
        System.out.println("Request Whole Body => " + requestString);

        String responseString = null;
        try {
            responseString = HttpUtil.post(URL_TRANSFER_APPLY, requestString);
            System.out.println("Response Whole Body => " + responseString);

            ResponseData res = JSON.parseObject(responseString, ResponseData.class);
            // Successful,
            if ("Successful".equals(res.getState())) {
                System.out.printf("[%s]%s%n", res.getCode(), res.getMessage());

                String sign = Md5Util.MD5Encode(res.getPayload() + SIGN_KEY, "UTF-8").toUpperCase();
                boolean validSign = sign.equals(res.getSign());
                System.out.println("Check Signature => " + validSign);

                if (validSign) {
                    String resPlainPayload = AesUtil.decrypt(res.getPayload(), ENC_KEY);
                    System.out.println("Response Plain Payload <= " + resPlainPayload);

                    JSONObject rspObj = JSON.parseObject(resPlainPayload);

                    String status = rspObj.getString("status");

                    System.out.println("Order status: " + status);
                    System.out.println("Order description: " + rspObj.getString("statusDesc"));

                    // When to create a payment successful, to get the payment links
                    if ("02".equals(status)) {
                        System.out.println("It has been marked by failure");
                    }
                    //
                    else {
                        System.out.println("Be careful: it has been accepted, to query the result, or to listen webhook result");
                    }

                }
            }
            // 4002, Duplicate order request
            else if (res.getCode() == 4002) {
                System.out.println("Be careful: it could been existed transaction, to query the result by tradeNo");
            }
            // 9003
            else if (res.getCode() == 9003) {
                System.out.println("Be careful: it could been accepted, to query the result by tradeNo");
            }

            // Failed by other value of the code
            else {
                System.out.println("It's failure");
                System.out.printf("[%s]%s%n", res.getCode(), res.getMessage());
            }
        } catch (Exception e) {
            System.out.println("Be careful: it could be caused by network issue, to query the result by tradeNo");

            System.out.println("Error Message => " + e.getMessage());
            e.printStackTrace();
        }
    }

    public static void doTransferQuery(String tradeNo) throws Exception {

        // tradeNo, Merchant Transaction Number, Required, Internal transaction number, ensure uniqueness

        Map<String, String> payloadMap = new HashMap<>();
        // versionNo, Interface Version, Required, Fixed value of 1 2
        payloadMap.put("versionNo", "1");
        // mchNo, Merchant Number, Required, Assigned by the platform  16
        payloadMap.put("mchNo", MCH_NO);
        // tradeNo Merchant Transaction Number Required Internal transaction number, ensure uniqueness 32
        payloadMap.put("tradeNo", tradeNo);

        String plainPayload = JSON.toJSONString(payloadMap);
        System.out.println("Request Plain Payload => " + plainPayload);

        String encryptPayload = AesUtil.encrypt(plainPayload, ENC_KEY);
        System.out.println("Request Encrypt Payload => " + encryptPayload);

        String signedValue = Md5Util.MD5Encode(encryptPayload + SIGN_KEY, "UTF-8").toUpperCase();
        System.out.println("Request Signed Value => " + signedValue);

        RequestData req = new RequestData();
        req.setMchNo(MCH_NO);
        req.setPayload(encryptPayload);
        req.setSign(signedValue);

        String requestString = JSON.toJSONString(req);
        System.out.println("Request Whole Body => " + requestString);

        String responseString = null;
        try {
            responseString = HttpUtil.post(URL_TRANSFER_QUERY, requestString);
            System.out.println("Response Whole Body => " + responseString);

            ResponseData res = JSON.parseObject(responseString, ResponseData.class);
            // Successful,
            if ("Successful".equals(res.getState())) {
                System.out.printf("[%s]%s%n", res.getCode(), res.getMessage());

                String sign = Md5Util.MD5Encode(res.getPayload() + SIGN_KEY, "UTF-8").toUpperCase();
                boolean validSign = sign.equals(res.getSign());
                System.out.println("Check Signature => " + validSign);

                if (validSign) {
                    String resPlainPayload = AesUtil.decrypt(res.getPayload(), ENC_KEY);
                    System.out.println("Response Plain Payload <= " + resPlainPayload);

                    // JSONObject rspObj = JSON.parseObject(resPlainPayload);
                }
            }
            // 4001	Original order does not exist
            else if (res.getCode() == 4001) {
                System.out.println("It has been marked by failure");
                System.out.println("FYI: it could been re-submit by the the exactly same tradeNo");
            }
            // Failed
            else {
                System.out.println("It has been marked by failure");
                System.out.printf("[%s]%s%n", res.getCode(), res.getMessage());
            }
        } catch (Exception e) {
            System.out.println("Error Message => " + e.getMessage());
            e.printStackTrace();
        }
    }


    public static void payoutWebhook() {
        try {
            String notifyString = "{\"code\":0,\"mchNo\":\"A0001\",\"payload\":\"U5Prr5mHcpXdTXBJK/Q5ZttikkLmTAUExmYm89honLHSc6Ob/Bt3beW/QVKl1woH/5qEOBzW3bnhv6vr6IPx+oxFQCwle9ihdonIzdli5YTzd0J1OAWBeuXE0qykz8efb90zbBHVdEp/jWlPLXBNj9lF+cGLnjbhLRMAJsLoqkwMoGNpeVLFJ704m33B5F5ObVoh7JJWZV35HY/x0KxOs6aFEHZqIbyMkjoSxyCRgzHOlA/1pt5TKJGW1iIxQuPRufvi0IhnX5CXAS5fN6A5ir+fmL2H14dDrx8VZpAfZQEWEaF1N5Y/JQvp58hkmqmyxbQeo3yJURf3cm3FPgClYhbZNVgKt7ljGucRAsUCQ0k=\",\"sign\":\"2C53ACC75B6050343B9B538D20363DE2\",\"state\":\"Successful\"}";
            ResponseData res = JSON.parseObject(notifyString, ResponseData.class);

            String sign = Md5Util.MD5Encode(res.getPayload() + SIGN_KEY, "UTF-8").toUpperCase();
            boolean validSign = sign.equals(res.getSign());
            System.out.println("Check Signature => " + validSign);

            if (validSign) {
                String resPlainPayload = AesUtil.decrypt(res.getPayload(), ENC_KEY);
                System.out.println("Response Plain Payload -> " + resPlainPayload);

                // JSONObject rspObj = JSON.parseObject(resPlainPayload);
            }
        }
        //
        catch (Exception e) {
            System.out.println("Error Message => " + e.getMessage());
            e.printStackTrace();
        }
    }
}
