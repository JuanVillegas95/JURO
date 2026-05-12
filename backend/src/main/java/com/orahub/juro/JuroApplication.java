package com.orahub.juro;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class JuroApplication {

    public static void main(String[] args) {
        SpringApplication.run(JuroApplication.class, args);
    }
}
