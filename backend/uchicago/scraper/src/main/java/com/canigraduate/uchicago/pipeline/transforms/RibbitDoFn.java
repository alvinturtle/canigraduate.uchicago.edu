package com.canigraduate.uchicago.pipeline.transforms;

import com.canigraduate.uchicago.models.Course;
import com.canigraduate.uchicago.pipeline.firestore.UploadDoFn;
import com.canigraduate.uchicago.ribbit.Ribbit;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.values.KV;

import java.io.IOException;
import java.util.logging.Logger;

public class RibbitDoFn extends DoFn<String, KV<String, Course>> {
    private static final Logger LOGGER = Logger.getLogger(UploadDoFn.class.getName());

    @ProcessElement
    public void processElement(ProcessContext c) {
        try {
            Ribbit.getRecordForCourse(c.element()).ifPresent(course -> c.output(KV.of(c.element(), course)));
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}