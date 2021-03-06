package com.canigraduate.uchicago.pipeline.transforms;

import com.canigraduate.uchicago.coursesearch.CourseSearch;
import com.canigraduate.uchicago.models.Course;
import com.canigraduate.uchicago.pipeline.models.TermAndDepartment;
import com.canigraduate.uchicago.pipeline.models.TermKey;
import com.google.auto.value.AutoValue;
import com.google.common.collect.Streams;
import org.apache.beam.sdk.transforms.*;
import org.apache.beam.sdk.values.*;
import org.apache.logging.log4j.ThreadContext;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

public class CourseSearchTransform extends PTransform<PBegin, PCollection<KV<TermKey, Course>>> {
    private static final TypeDescriptor<TermKey> KEY = TypeDescriptor.of(TermKey.class);
    private static final TypeDescriptor<Course> COURSE = TypeDescriptor.of(Course.class);
    private static final TypeDescriptor<TermAndDepartment> TERM_AND_DEPARTMENT = TypeDescriptor.of(
            TermAndDepartment.class);
    private static final TypeDescriptor<Params> PARAMS = TypeDescriptor.of(Params.class);

    @Override
    public PCollection<KV<TermKey, Course>> expand(PBegin input) {
        try {
            return input.getPipeline()
                    .apply("Get terms", Create.of(CourseSearch.getTerms()))
                    .apply("Get departments",
                            FlatMapElements.into(TypeDescriptors.kvs(TERM_AND_DEPARTMENT, PARAMS)).via(e -> {
                                try {
                                    return CourseSearch.getDepartments(e.getValue())
                                            .entrySet()
                                            .stream()
                                            .map(entry -> KV.of(TermAndDepartment.create(e.getKey(), entry.getKey()),
                                                    Params.create(e.getValue(), entry.getValue())))
                                            .collect(Collectors.toList());
                                } catch (IOException ex) {
                                    throw new RuntimeException(ex);
                                }
                            }))
                    .apply("Fetch departments",
                            FlatMapElements.into(TypeDescriptors.kvs(TERM_AND_DEPARTMENT, TypeDescriptors.strings()))
                                    .via(e -> CourseSearch.getCoursePages(e.getValue().getTermKey(),
                                            e.getValue().getDepartmentKey())
                                            .stream()
                                            .map(entry -> KV.of(e.getKey(), entry))
                                            .collect(Collectors.toList())))
                    .apply("Get courses", MapElements.into(TypeDescriptors.kvs(KEY, COURSE)).via(e -> {
                        TermAndDepartment key = Objects.requireNonNull(e.getKey());
                        ThreadContext.push(key.toString());
                        Map.Entry<String, Course> entry = CourseSearch.getCourseEntry(e.getValue());
                        ThreadContext.pop();
                        return KV.of(TermKey.builder().setTerm(key.getTerm()).setCourse(entry.getKey()).build(),
                                entry.getValue());
                    }))
                    // Merge the courses, as CourseSearch produces one Course per section.
                    .apply("Group by key", GroupByKey.create())
                    .apply("Merge courses", MapElements.into(
                            TypeDescriptors.kvs(TypeDescriptor.of(TermKey.class), TypeDescriptor.of(Course.class)))
                            .via(kv -> KV.of(kv.getKey(), Streams.stream(kv.getValue()).reduce(null, Course::create))));
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    @AutoValue
    public abstract static class Params {
        public static Params create(String newTermKey, String newDepartmentKey) {
            return new AutoValue_CourseSearchTransform_Params(newTermKey, newDepartmentKey);
        }

        public abstract String getTermKey();

        public abstract String getDepartmentKey();

    }
}
