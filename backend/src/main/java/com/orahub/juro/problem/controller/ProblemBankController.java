package com.orahub.juro.problem.controller;

import com.orahub.juro.problem.dto.ProblemBankExportResponse;
import com.orahub.juro.problem.dto.ProblemBankImportResponse;
import com.orahub.juro.problem.service.ProblemBankTransferService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/problem-bank")
public class ProblemBankController {

    private final ProblemBankTransferService transferService;

    public ProblemBankController(ProblemBankTransferService transferService) {
        this.transferService = transferService;
    }

    @GetMapping("/export")
    public ProblemBankExportResponse exportProblemBank() {
        return transferService.exportProblemBank();
    }

    @PostMapping("/import")
    public ProblemBankImportResponse importProblemBank(@RequestBody ProblemBankExportResponse snapshot) {
        return transferService.importProblemBank(snapshot);
    }
}
