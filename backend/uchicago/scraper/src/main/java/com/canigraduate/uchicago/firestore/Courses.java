package com.canigraduate.uchicago.firestore;

import com.canigraduate.uchicago.deserializers.CourseDeserializer;
import com.canigraduate.uchicago.firestore.models.Document;
import com.canigraduate.uchicago.firestore.models.Write;
import com.canigraduate.uchicago.models.Course;
import com.canigraduate.uchicago.serializers.CourseSerializer;
import com.google.common.base.Preconditions;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Streams;
import com.google.gson.JsonObject;

import java.util.AbstractMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class Courses {
    private final CollectionReference root;

    public Courses() {
        this.root = FirestoreService.getUChicago().collection("courses");
    }

    public void delete(String course) {
        root.document(course).delete();
    }

    public Iterable<String> list() {
        return root.documentIds();
    }

    public Iterable<Map.Entry<String, Course>> all() {
        return Streams.stream(root.allDocuments())
                .map(doc -> new AbstractMap.SimpleImmutableEntry<>(doc.getId(),
                        CourseDeserializer.fromMapValue(doc.getFields())))
                .collect(Collectors.toList());
    }

    public Optional<Course> get(String course) {
        return get(course, null);
    }

    public Optional<Course> get(String course, String transaction) {
        return root.document(course).get(transaction).map(Document::getFields).map(CourseDeserializer::fromMapValue);
    }

    public JsonObject set(String id, Course course) {
        return set(id, course, null);
    }

    public JsonObject set(String id, Course course, String transaction) {
        Preconditions.checkState(id.length() == 10, "Course id is wrong length: " + id);
        return FirestoreService.commit(ImmutableList.of(new Write().setUpdate(
                new Document().setFields(CourseSerializer.toMapValue(course)).setName("courses/" + id))), transaction);
    }
}
