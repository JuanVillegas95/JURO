package com.orahub.juro.localworkspace;

public record ToolCommandStatus(
        String name,
        boolean available,
        String version,
        String detail
) {
}
