package com.canigraduate.uchicago.pipeline.coders;

import com.canigraduate.uchicago.models.Term;
import com.canigraduate.uchicago.pipeline.models.Key;
import org.apache.beam.sdk.coders.Coder;
import org.apache.beam.sdk.coders.CoderException;
import org.apache.beam.sdk.coders.CustomCoder;
import org.apache.beam.sdk.coders.StringUtf8Coder;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Optional;

public class KeyCoder extends CustomCoder<Key> {
    private static final Coder<Optional<Term>> TERM_OPTIONAL_CODER = OptionalCoder.of(TermCoder.of());
    private static final Coder<Optional<String>> STRING_OPTIONAL_CODER = OptionalCoder.of(StringUtf8Coder.of());

    public static KeyCoder of() {
        return new KeyCoder();
    }

    @Override
    public void encode(Key value, OutputStream outStream) throws CoderException, IOException {
        TERM_OPTIONAL_CODER.encode(value.getTerm(), outStream);
        STRING_OPTIONAL_CODER.encode(value.getDepartment(), outStream);
        STRING_OPTIONAL_CODER.encode(value.getCourse(), outStream);
    }

    @Override
    public Key decode(InputStream inStream) throws CoderException, IOException {
        return Key.builder()
                .setTerm(TERM_OPTIONAL_CODER.decode(inStream))
                .setDepartment(STRING_OPTIONAL_CODER.decode(inStream))
                .setCourse(STRING_OPTIONAL_CODER.decode(inStream))
                .build();
    }
}
