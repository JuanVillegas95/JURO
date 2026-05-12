package com.orahub.juro.problem.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.localworkspace.LocalSettingsService;
import com.orahub.juro.localworkspace.LocalWorkspaceSettings;
import com.orahub.juro.problem.dto.ProblemBankExportResponse;
import com.orahub.juro.problem.dto.ProblemBankFileSyncStatus;
import com.orahub.juro.problem.dto.ProblemBankImportResponse;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

@Service
public class ProblemBankFileSyncService {

    private final LocalSettingsService settingsService;
    private final ProblemBankTransferService transferService;
    private final ObjectMapper objectMapper;

    private String lastPath = "";
    private String lastAttemptedFingerprint = "";
    private String lastImportedFingerprint = "";
    private Instant lastImportedAt;
    private String lastImportSummary;
    private String lastError;
    private boolean importInProgress;

    public ProblemBankFileSyncService(
            LocalSettingsService settingsService,
            ProblemBankTransferService transferService,
            ObjectMapper objectMapper
    ) {
        this.settingsService = settingsService;
        this.transferService = transferService;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelayString = "${app.problem-bank.file-sync.poll-ms:2000}")
    public void pollConfiguredFile() {
        try {
            importChangedFile(false);
        } catch (RuntimeException ignored) {
            // Status keeps the user-facing error. Scheduled polling must not stop after a bad edit.
        }
    }

    public synchronized ProblemBankFileSyncStatus status() {
        return status(settingsService.getSettings());
    }

    public synchronized ProblemBankFileSyncStatus importNow() {
        importChangedFile(true);
        return status(settingsService.getSettings());
    }

    public synchronized ProblemBankFileSyncStatus writeSnapshot() {
        LocalWorkspaceSettings settings = settingsService.getSettings();
        Path path = configuredPath(settings);
        if (!settings.problemBankSyncEnabled()) {
            throw new IllegalStateException("Enable problem bank JSON sync before writing the sync file.");
        }
        if (path == null) {
            throw new IllegalStateException("Set a problem bank JSON sync file path before writing the sync file.");
        }

        try {
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), transferService.exportProblemBank());
            FileState fileState = readFileState(path);
            lastPath = path.toString();
            lastAttemptedFingerprint = fileState.fingerprint();
            lastImportedFingerprint = fileState.fingerprint();
            lastImportedAt = Instant.now();
            lastImportSummary = "Wrote current problem bank snapshot to the live JSON file.";
            lastError = null;
            return status(settings);
        } catch (IOException exception) {
            lastPath = path.toString();
            lastError = "Unable to write problem bank JSON file: " + exception.getMessage();
            throw new IllegalStateException(lastError, exception);
        }
    }

    private void importChangedFile(boolean force) {
        LocalWorkspaceSettings settings = settingsService.getSettings();
        Path path = configuredPath(settings);
        if (!settings.problemBankSyncEnabled() || path == null) {
            return;
        }

        FileState fileState = readFileState(path);
        lastPath = path.toString();
        if (!fileState.exists()) {
            lastError = "Problem bank JSON sync file does not exist.";
            return;
        }

        String fingerprint = fileState.fingerprint();
        if (!force && fingerprint.equals(lastAttemptedFingerprint)) {
            return;
        }

        lastAttemptedFingerprint = fingerprint;
        importInProgress = true;
        try {
            ProblemBankExportResponse snapshot = objectMapper.readValue(path.toFile(), ProblemBankExportResponse.class);
            ProblemBankImportResponse result = transferService.importProblemBank(snapshot);
            lastImportedFingerprint = fingerprint;
            lastImportedAt = Instant.now();
            lastImportSummary = "Imported %d problems, %d review schedules, and %d submissions from live JSON."
                    .formatted(
                            result.created() + result.updated(),
                            result.reviewStatesImported(),
                            result.submissionsImported()
                    );
            lastError = null;
        } catch (Exception exception) {
            lastError = "Unable to import problem bank JSON file: " + rootMessage(exception);
        } finally {
            importInProgress = false;
        }
    }

    private ProblemBankFileSyncStatus status(LocalWorkspaceSettings settings) {
        Path path = configuredPath(settings);
        if (!settings.problemBankSyncEnabled() || path == null) {
            return new ProblemBankFileSyncStatus(
                    settings.problemBankSyncEnabled(),
                    path == null ? "" : path.toString(),
                    false,
                    null,
                    null,
                    importInProgress,
                    lastImportedAt,
                    lastImportSummary,
                    null,
                    false
            );
        }

        FileState fileState = readFileState(path);
        boolean samePath = path.toString().equals(lastPath);
        String activeError = samePath ? lastError : null;
        if (!fileState.exists()) {
            activeError = "Problem bank JSON sync file does not exist.";
        }
        boolean synced = fileState.exists()
                && fileState.fingerprint().equals(lastImportedFingerprint)
                && activeError == null
                && !importInProgress;

        return new ProblemBankFileSyncStatus(
                true,
                path.toString(),
                fileState.exists(),
                fileState.lastModifiedAt(),
                fileState.sizeBytes(),
                importInProgress,
                samePath ? lastImportedAt : null,
                samePath ? lastImportSummary : null,
                activeError,
                synced
        );
    }

    private Path configuredPath(LocalWorkspaceSettings settings) {
        if (settings.problemBankSyncFilePath() == null || settings.problemBankSyncFilePath().isBlank()) {
            return null;
        }
        return Path.of(settings.problemBankSyncFilePath()).toAbsolutePath().normalize();
    }

    private FileState readFileState(Path path) {
        if (!Files.isRegularFile(path)) {
            return new FileState(false, null, null, "");
        }

        try {
            Instant lastModifiedAt = Files.getLastModifiedTime(path).toInstant();
            Long sizeBytes = Files.size(path);
            return new FileState(
                    true,
                    lastModifiedAt,
                    sizeBytes,
                    "%s:%s:%d".formatted(path, lastModifiedAt.toEpochMilli(), sizeBytes)
            );
        } catch (IOException exception) {
            return new FileState(false, null, null, "");
        }
    }

    private String rootMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current.getMessage() == null || current.getMessage().isBlank()
                ? current.getClass().getSimpleName()
                : current.getMessage();
    }

    private record FileState(
            boolean exists,
            Instant lastModifiedAt,
            Long sizeBytes,
            String fingerprint
    ) {
    }
}
