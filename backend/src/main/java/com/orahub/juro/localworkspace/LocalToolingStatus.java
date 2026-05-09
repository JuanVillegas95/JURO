package com.orahub.juro.localworkspace;

public record LocalToolingStatus(
        ToolCommandStatus javaRuntime,
        ToolCommandStatus javaCompiler,
        ToolCommandStatus maven,
        boolean workspaceConfigured,
        boolean workspaceWritable,
        String workspaceDirectory
) {
}
