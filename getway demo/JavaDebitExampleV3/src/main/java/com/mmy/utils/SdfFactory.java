package com.mmy.utils;

import java.text.FieldPosition;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Random;

public class SdfFactory {
    private static class ThreadSaftyDateFormat extends SimpleDateFormat {
        private static final long serialVersionUID = -797037383479610096L;

        ThreadSaftyDateFormat(String format) {
            super(format);
        }

        public synchronized StringBuffer format(Date date, StringBuffer toAppendTo, FieldPosition fieldPosition) {
            return super.format(date, toAppendTo, fieldPosition);
        }

        public synchronized Date parse(String text, ParsePosition pos) {
            return super.parse(text, pos);
        }
    }

    public static final SimpleDateFormat FULL = new ThreadSaftyDateFormat("yyyyMMddHHmmssSSS");

    public static final SimpleDateFormat PARTFULL = new ThreadSaftyDateFormat("yyMMddHHmmssSSS");

    public static final SimpleDateFormat DATETIME = new ThreadSaftyDateFormat("yyyyMMddHHmmss");

    public static final SimpleDateFormat SHORT_DATETIME = new ThreadSaftyDateFormat("yyMMddHHmm");

    public static Integer randomChoose(Integer max) {
        return randomChoose(max, 0);
    }

    public static Integer randomChoose(Integer max, Integer from) {
        return new Random().nextInt(max - from) + from;
    }

    private static Object obj = new Object();
    private static Integer index = 100;

    /**
     * @return
     */
    public static synchronized String getMemoryUniquedOrderNo() {
        String order = PARTFULL.format(new Date()) + randomChoose(10) + index;
        synchronized (obj) {
            if (index >= 999) {
                index = 100;
            } else {
                index++;
            }
        }
        return order;
    }
}
