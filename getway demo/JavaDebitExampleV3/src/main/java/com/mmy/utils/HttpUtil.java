package com.mmy.utils;

import org.apache.http.*;
import org.apache.http.client.config.CookieSpecs;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.config.Registry;
import org.apache.http.config.RegistryBuilder;
import org.apache.http.conn.ConnectionKeepAliveStrategy;
import org.apache.http.conn.socket.ConnectionSocketFactory;
import org.apache.http.conn.socket.LayeredConnectionSocketFactory;
import org.apache.http.conn.socket.PlainConnectionSocketFactory;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.apache.http.message.BasicHeaderElementIterator;
import org.apache.http.protocol.HTTP;
import org.apache.http.protocol.HttpContext;
import org.apache.http.util.EntityUtils;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.concurrent.TimeUnit;

/**
 *
 */
public class HttpUtil {
    private static final int MAX_TOTAL = 50;
    private static final int MAX_ROUTE = 50;
    private static final int CONN_TIMEOUT = 8000;
    private static final int READ_TIMEOUT = 40000;

    private static PoolingHttpClientConnectionManager connManager;
    private static CloseableHttpClient httpclient;

    static {
        try {
            init();
        } catch (Exception e) {
            throw new RuntimeException(e.getCause());
        }
    }

    public static String post(String url, String body) throws Exception {
        HttpPost post = null;
        String resData;
        CloseableHttpResponse result = null;
        try {
            post = new HttpPost(url);
            post.setConfig(RequestConfig.custom().setConnectTimeout(CONN_TIMEOUT).setSocketTimeout(READ_TIMEOUT).build());
            post.setHeader("Content-Type", "application/json");
            if (body != null) {
                HttpEntity entity2 = new StringEntity(body, Consts.UTF_8);
                post.setEntity(entity2);
            }
            result = httpclient.execute(post);
            if (HttpStatus.SC_OK == result.getStatusLine().getStatusCode()) {
                resData = EntityUtils.toString(result.getEntity());
            }
            //
            else {
                System.out.println(EntityUtils.toString(result.getEntity()));
                throw new Exception("StatusCode is " + result.getStatusLine().getStatusCode());
            }
        } finally {
            if (result != null) {
                result.close();
            }
            if (post != null) {
                post.releaseConnection();
            }
            httpclient.close();
        }
        return resData;
    }



    @SuppressWarnings("deprecation")
    public static void init() throws NoSuchAlgorithmException, KeyManagementException {
        SSLContext sslCtx = SSLContext.getInstance("TLSv1.2");
        X509TrustManager trustManager = new X509TrustManager() {
            public X509Certificate[] getAcceptedIssuers() {
                return null;
            }

            public void checkClientTrusted(X509Certificate[] arg0, String arg1) {
            }

            public void checkServerTrusted(X509Certificate[] arg0, String arg1) {
            }
        };
        sslCtx.init(null, new TrustManager[]{trustManager}, null);

        LayeredConnectionSocketFactory sslSocketFactory = new SSLConnectionSocketFactory(sslCtx, SSLConnectionSocketFactory.ALLOW_ALL_HOSTNAME_VERIFIER);
        RegistryBuilder<ConnectionSocketFactory> registryBuilder = RegistryBuilder.<ConnectionSocketFactory>create();
        ConnectionSocketFactory plainSocketFactory = new PlainConnectionSocketFactory();
        registryBuilder.register("http", plainSocketFactory);
        registryBuilder.register("https", sslSocketFactory);

        Registry<ConnectionSocketFactory> registry = registryBuilder.build();
        connManager = new PoolingHttpClientConnectionManager(registry);
        connManager.setMaxTotal(MAX_TOTAL);
        connManager.setDefaultMaxPerRoute(MAX_ROUTE);

        ConnectionKeepAliveStrategy myStrategy = (response, context) -> {
            HeaderElementIterator it = new BasicHeaderElementIterator(response.headerIterator(HTTP.CONN_KEEP_ALIVE));
            while (it.hasNext()) {
                HeaderElement he = it.nextElement();
                String param = he.getName();
                String value = he.getValue();
                if (value != null && param.equalsIgnoreCase("timeout")) {
                    try {
                        return Long.parseLong(value) * 1000;
                    } catch (NumberFormatException ignore) {
                    }
                }
            }
            return 20 * 1000;
        };

        httpclient = HttpClientBuilder.create().setConnectionManager(connManager).setKeepAliveStrategy(myStrategy).build();

        new Thread(new Runnable() {
            @Override
            public void run() {
                while (true) {
                    try {
                        synchronized (this) {
                            wait(500);
                            connManager.closeExpiredConnections();
                            connManager.closeIdleConnections(40, TimeUnit.SECONDS);
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }).start();
    }


}
