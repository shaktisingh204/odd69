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
 * Do payment transaction Example
 */
public class PaymentTransExample {
    private static final String BASE_URL = "https://phpay.ipayment.vip/dgateway";
//    private static final String BASE_URL = "http://localhost:8080/debitpay";

    private static final String URL_PAYMENT_APPLY = BASE_URL + "/ws/trans/nocard/makeOrder";
    private static final String URL_PAYMENT_QUERY = BASE_URL + "/ws/trans/nocard/orderQuery";

    private static final String MCH_NO = "A0001";
    private static final String ENC_KEY = "1234567812345678";
    private static final String SIGN_KEY = "1234";

    public static void main(String[] args) throws Exception {
        // [1]. Payment Apply
        doPaymentApply();

        // [2]. Payment Query
        // doPaymentQuery("D1721983755801");
    }

    public static void doPaymentApply() throws Exception {
        Map<String, String> payloadMap = new HashMap<>();
        // versionNo, Interface Version, Required, Fixed value of 1 2
        payloadMap.put("versionNo", "1");
        // mchNo, Merchant Number, Required, Assigned by the platform  16
        payloadMap.put("mchNo", MCH_NO);
        // price, Payment Amount, Required, Unit: INR, precise to 1, must be greater than 1 INR
        payloadMap.put("price", new BigDecimal("10000").toString());
        // orderDate Order Date Required Format: yyyyMMddHHmmss (e.g., 20161021185120) 16
        payloadMap.put("orderDate", SdfFactory.DATETIME.format(new Date()));
        // tradeNo Merchant Transaction Number Required Internal transaction number, ensure uniqueness 32
        payloadMap.put("tradeNo", "D" + System.currentTimeMillis());
        // notifyUrl Asynchronous Notification URL Required URL for notification of success or failure 200
        payloadMap.put("notifyUrl", "https://www.example.com");
        // payType Payment Type Required, Fixed value: 01 - default method
        payloadMap.put("payType", "01");

        // Payer Name, Optional, Example: user name
        payloadMap.put("payerName", "Jack");
        // Payer Mobile, Optional, Example: 66123456789
        payloadMap.put("payMobile", "66123456789");
        // Payer Email,	Optional, Example: tom@example.com
        payloadMap.put("payEmail", "tom@example.com");

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
            responseString = HttpUtil.post(URL_PAYMENT_APPLY, requestString);
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
                    if ("00".equals(status)) {
                        System.out.println("Links: " + rspObj.getString("payUrl"));
                    }
                    // For other status code
                    else {
                        System.out.println("It has been marked by failure");
                    }
                }
            }
            // Failed
            else {
                System.out.printf("[%s]%s%n", res.getCode(), res.getMessage());
            }
        } catch (Exception e) {
            System.out.println("Error Message => " + e.getMessage());
            e.printStackTrace();
        }
    }

    public static void doPaymentQuery(String tradeNo) throws Exception {

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
            responseString = HttpUtil.post(URL_PAYMENT_QUERY, requestString);
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
                    // When the transaction is successful
                    if ("00".equals(rspObj.getString("status"))) {
                        System.out.println("Real PayIn Amount: " + rspObj.getString("price"));
                        System.out.println("Original Order Amount: " + rspObj.getString("oriPrice"));
                    }
                }
            }
            // 4001, Original order does not exist
            else if (res.getCode() == 4001) {
                System.out.println("It has been marked by failure");
                System.out.println("FYI: it could been re-submit by the the exactly same tradeNo");
            }
            // Failed
            else {
                System.out.printf("[%s]%s%n", res.getCode(), res.getMessage());
            }
        } catch (Exception e) {
            System.out.println("Error Message => " + e.getMessage());
            e.printStackTrace();
        }
    }


}
